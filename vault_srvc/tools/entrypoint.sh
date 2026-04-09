#!/bin/sh

set -euo pipefail

check_vault_seal ()	{
	if vault status -non-interactive &>/dev/null; then
		echo "Vault unsealed!"
		return 1
	else
		echo "Vault still sealed!"
		return 0
	fi
}

find_vault_keys ()	{
	if [ -f "/vault/secret/.keyshares" ]; then
		echo "Vault Keyshares found!"
		return 0
	else
		echo "Could not find Vault Keyshares!"
		return 1 
	fi
}

find_vault_cacert ()	{
	if [ -f "/vault/secret/cacert/root_""$1""_ca.crt" ]; then
		echo "Vault CA Certificate found!"
		return 0
	else
		echo "Could not find Vault CA Certificate!"
		return 1
	fi
}

try_vault_unseal ()	{
	if check_vault_seal; then
		if ! find_vault_keys; then
			if vault operator init -status; then
				echo "FATAL_ERROR: VAULT INITIALIZED BUT NO KEYSHARES FOUND"
				exit 1
			else
				vault operator init -key-shares="$keyshare_count" -key-threshold="$keyshare_count" |	\
					while read line; do
					if [ "${line:0:11}" = "Unseal Key " ]; then
						keyshare=${line:14}
						vault operator unseal "$keyshare" &>/dev/null
						echo "$keyshare" >> "/vault/secret/.keyshares"
					elif [ "${line:0:20}" = "Initial Root Token: " ]; then
						vault_root_token=${line:20}
						echo "$vault_root_token" > "/vault/secret/.root_token"
						chmod 400 "/vault/secret/.root_token"
					fi
				done
				chmod 400 "/vault/secret/.keyshares"
			fi
		else
			while read keyshare; do
				vault operator unseal "$keyshare" &>/dev/null
			done < /vault/secret/.keyshares 
		fi

		export VAULT_TOKEN=$(cat /vault/secret/.root_token)
	fi
}

start_and_unseal_vault ()	{
		echo "Starting Vault-""$1"" Server..."

		if [ "$1" != "default" ]; then
			vault server	-config="/vault/config/$2-$1.hcl"	\
					2>"/vault/logs/vault-""$1""_stderr.log"	\
					1>"/vault/logs/vault-""$1""_stdout.log"	&

			server_pid=$!
		fi


		set +e

		status_code=1
		while [ $status_code -eq 1 ]; do
			vault status -non-interactive &>/dev/null
			status_code=$?
			echo "Waiting for startup... $status_code"
			sleep .42
		done

		set -e

		echo "Vault-$1 server started!"

		try_vault_unseal
}

create_vault_intermediate_pki ()	{
	vault secrets enable -path="pki_""$1""_int" "pki"
	vault secrets tune -max-lease-ttl="43800h" "pki_""$1""_int"

	vault write -format=json "pki_""$1""_int/intermediate/generate/internal"\
		common_name="$2""-""$1"" Intermediate Authority"		\
		issuer_name="$2""-""$1""-intermediate"				\
		| jq -r '.data.csr' > "pki_""$1""_intermediate.csr"

	vault write -format=json "pki/root/sign-intermediate"			\
		issuer_ref="root-""$2"						\
		csr="@pki_""$1""_intermediate.csr"				\
		format=pem_bundle ttl="43800h"					\
		| jq -r '.data.certificate' > "$1""_intermediate.cert.pem"

	vault write "pki_""$1""_int/intermediate/set-signed"			\
		"certificate=@""$1""_intermediate.cert.pem"

	vault write "pki_""$1""_int/roles/""$2""-""$1"				\
	issuer_ref="$(vault read -field=default pki_$1_int/config/issuers)"	\
		allowed_domains="$allowed_domains"				\
		allow_subdomains=true						\
		max_ttl="21900h"

	mkdir -p "/vault/secret/cacert/bundles/""$2""/""$1"
}

create_vault_root_pki ()	{
	vault policy write cacert /vault/policies/cacert.hcl

	vault secrets enable pki
	vault secrets tune -max-lease-ttl=87600h pki

	vault write -field=certificate "pki/root/generate/internal"		\
	     common_name="$PROJECT_NAME"					\
	     issuer_name="root-""$PROJECT_NAME"						\
	     ttl="87600h" > "/vault/secret/cacert/root_""$PROJECT_NAME""_ca.crt"

	vault write "pki/roles/""$PROJECT_NAME""-servers" allow_any_name=true

	vault write "pki/config/urls"						\
		issuing_certificates="https://127.0.0.1:""$VAULT_PORT""/v1/pki/ca"\
		crl_distribution_points="https://127.0.0.1:""$VAULT_PORT""/v1/pki/crl"

	mkdir -p "/vault/secret/cacert/bundles/""$PROJECT_NAME"
}

create_vault_cacert ()	{
	export VAULT_ADDR="http://127.0.0.1:""$VAULT_BOOTSTRAP_PORT"

	start_and_unseal_vault bootstrap "$1"

	create_vault_root_pki "$1"

	intermediates="$SERVICE_NAMESPACE $VAULT_NAMESPACE $REV_PROXY_NAMESPACE $DATABASE_NAMESPACE"

	for intermediate in $intermediates; do
		create_vault_intermediate_pki "$intermediate" "$1"
	done &>/dev/null

	if [ -d "/tor" ]; then
		create_vault_intermediate_pki "tor" "$1" &>/dev/null
	fi

	mkdir /vault/secret/cacert/int
	mv *.csr *.pem /vault/secret/cacert/int

	vault write -format=json "pki_secret_int/issue/"$1"-secret"	\
		common_name="vault."$1"-secret"				\
		alt_names="vault_srvc,vault_service" ttl="21000h"	\
		ip_sans="127.0.0.1,133.7.42.4,133.7.42.17"		\
		client_flag=true server_flag=true			\
		format="pem_bundle" > tmp.pem.json

	cat tmp.pem.json | jq -r '.data.certificate' > 			\
		"/vault/secret/cacert/""$1""-secret-vault.crt"
	cat tmp.pem.json | jq -r '.data.private_key' > 			\
		"/vault/secret/cacert/""$1""-secret-vault.key"

	chmod 444	"/vault/secret/cacert/""$1""-secret-vault.crt"	\
			"/vault/secret/cacert/""$1""-secret-vault.key"

	chown -R vault:vault /vault/secret/cacert

	vault operator seal

	kill $server_pid
	wait $server_pid

	unset	VAULT_ADDR
}

create_vault_policies ()	{
	date="$(date -u -I)"

	mkdir -p /vault/distribute/inject
	armored_http="${HTTP::-3}"":\/\/"
	sed "s/CHANGE_ME/$armored_http$(hostname)\/v1/g" /tools/inject.sh >	\
			/vault/distribute/inject/inject.sh
	chmod	100	/vault/distribute/inject/inject.sh

	vault auth enable cert
	vault write "auth/cert/config" enable_metadata_on_failures=true
	vault secrets enable -path secret kv-v2

	touch /.policies_done

	for policy in $(ls -lp /vault/policies/ | grep -v / | tail -n +2 | cut -b 58-); do

		service=${policy:0:-4}

		mkdir -p /vault/distribute/$service

		if [ "$policy" = "cacert.hcl" ]; then
			cp -a	"/vault/secret/""$service""/root_""$PROJECT_NAME""_ca.crt" \
					"/vault/distribute/""$service""/"
			chmod	444	"/vault/distribute/""$service""/root_""$PROJECT_NAME""_ca.crt"
		else
			vault policy write "$service" "/vault/policies/$policy"
			vault write auth/token/roles/"$service"			\
				role_name="$service"				\
				allowed_entity_aliases="$service"		\
				allowed_policies="$service"			\
				orphan=true					\
				renewable=false	use-limit=1			\
				token_no_default_policy=true			\
				token_explicit_max_ttls=15m

			if [ "${service: -5}" = "proxy" ]; then
				net="proxy"
				subdomain=${service%_proxy}
			elif [ "${service: -2}" = "db" ]; then
				net="db"
				subdomain=${service%_db}
			else
				net="backend"
				subdomain=${service%_srvc}
			fi
			vault write -format=json "pki_""$net""_int/issue/""$1""-""$net"	\
				common_name="$subdomain"".""$1""-""$net"		\
				alt_names="$subdomain""_srvc,""$subdomain""_service"	\
				key_type="rsa" key_bits=8192 signature_bits=512		\
				ttl="21000h" client_flag=true server_flag=true		\
				format="pem_bundle" > tmp.pem.json

			cat tmp.pem.json | jq -r '.data.certificate' > 		\
			"/vault/distribute/""$service""/cert.pem"
			cat tmp.pem.json | jq -r '.data.private_key' > 		\
			"/vault/distribute/""$service""/key.pem"

			mv tmp.pem.json "/vault/secret/cacert/bundles/""$1""/""$net""/""$subdomain""-""$date"".pem.json"

			vault write auth/cert/certs/$service token_policies=$service	\
				certificate="@/vault/distribute/""$service""/cert.pem"

			if [ -f "/vault/policies/password/"$subdomain"_pw.hcl" ]; then
				vault write	"sys/policies/password/""$subdomain"	\
				policy="@/vault/policies/password/""$subdomain""_pw.hcl"

				export "$(echo "$subdomain" | tr '[:lower:]' '[:upper:]'\
				)""_PASSWORD=""$(vault read -field password		\
				sys/policies/password/"$subdomain"/generate)"
				export "$(echo "$subdomain" | tr '[:lower:]' '[:upper:]'\
				)""_PASSWORD_VAULT_GAME=""$(vault read -field password	\
				sys/policies/password/"$subdomain"/generate)"
				export "$(echo "$subdomain" | tr '[:lower:]' '[:upper:]'\
				)""_PASSWORD_VAULT_AUTH=""$(vault read -field password	\
				sys/policies/password/"$subdomain"/generate)"
			fi

			if [ -f "/vault/policies/env/""$subdomain""_wants.env" ]; then
				env_bundle=$(create_env_bundles "$subdomain")
				vault kv put -mount secret "$subdomain""/env" "env""=""$env_bundle"
			fi
		fi
	done
}

try_vanity_address ()		{
	if [ ! -d "/tor/onion_service" ]; then
		mv "/tor/""$VANITY_ADDRESS_MAIN"* /tor/onion_service
		chmod -R 700 /tor
		chown -R 100:101 /tor
	fi
	if [ ! -d "/tor/tor/other_onion_service" ]; then
		mv "/tor/""$VANITY_ADDRESS_VAULT"* /tor/other_onion_service
		mkdir -p /tor/other_onion_service/authorized_clients
		chmod -R 700 /tor
		chown -R 100:101 /tor
	fi
	set +e
		rm -rf	"/tor/tor/""$VANITY_ADDRESS_MAIN""*" \
			"/tor/tor/""$VANITY_ADDRESS_VAULT""*"
	set -e
}
setup_postgres_db ()		{
	set -xv
	vault secrets enable database

	while [ "$(vault kv get -mount secret -field init postgres/init)" != "true" ]; do
		echo "waiting for postgres to setup the initial database..."
		sleep 1
	done 2>/dev/null

	sleep 2
	vault write "database/config/""$GAME_DB"					\
		plugin_name="postgresql-database-plugin"				\
		allowed_roles="$GAME_DB""_game"						\
		connection_url="postgresql://{{username}}:{{password}}@postgres.""$PROJECT_NAME""-""$DATABASE_NAMESPACE"":""$POSTGRES_PORT""/""$GAME_DB"\
		username="$POSTGRES_USER_VAULT_GAME"					\
		password="$POSTGRES_PASSWORD_VAULT_GAME"				\
		password_authentication="scram-sha-256"					\
		password_policy="postgres"

	vault write "database/config/""$AUTH_DB"					\
		plugin_name="postgresql-database-plugin"				\
		allowed_roles="$AUTH_DB""_auth"						\
		connection_url="postgresql://{{username}}:{{password}}@postgres.""$PROJECT_NAME""-""$DATABASE_NAMESPACE"":""$POSTGRES_PORT""/""$AUTH_DB"\
		username="$POSTGRES_USER_VAULT_AUTH"					\
		password="$POSTGRES_PASSWORD_VAULT_AUTH"				\
		password_authentication="scram-sha-256"					\
		password_policy="postgres"

	vault write "database/roles/""$AUTH_DB""_auth" db_name="$AUTH_DB"		\
		creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}'; \
		GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\"; \
		GRANT CREATE ON SCHEMA public TO \"{{name}}\";"

	vault write "database/roles/""$GAME_DB""_game" db_name="$GAME_DB"		\
		creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}'; \
		GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\"; \
		GRANT CREATE ON SCHEMA public TO \"{{name}}\";"
}

create_env_bundles ()		{
	for key in $(cat "/vault/policies/env/""$1""_wants.env"); do
		case $key in
			"CORS_ALLOWED_ORIGIN" | "PUBLIC_URL" | "SOCKET_IO_ALLOWLIST" | "CHAT_WS_CORS" | "GAME_WS_CORS" | "AUTH_CORS")
				echo " $key""=""$HTTP""$PUBLIC_URL"
				;;
			"INTERNAL_SERVICE_SECRET" | "SERVICE_SECRET")
				echo " $key""=""$INTERNAL_SECRET"
				;;
			"AI_LOG_LEVEL")
				echo " LOG_LEVEL""=""$AI_LOG_LEVEL"
				;;
			"MONGODB_URI" | "CHAT_DB_URL")
				echo " $key""=""mongodb://mongo.""$PROJECT_NAME""-""$DATABASE_NAMESPACE"":""$MONGO_PORT""/""$CHAT_DB"
				;;
			"PORT")
				echo " $key""=""$SOME_GAME_PORT_IG"
				;;
			"PGPORT" | "POSTGRES_PORT")
				echo " $key""=""$POSTGRES_PORT"
				;;
			"PGSSLCERT" | "CERT_PATH")
				echo " $key""=""$CERT_PATH"
				;;
			"PGSSLKEY" | "KEY_PATH")
				echo " $key""=""$KEY_PATH"
				;;
			*)
				echo " $key""=""$(printenv "$key")"
				;;
		esac
	done
}





init_vault ()			{
	if [ ! -d "/vault/secret" ]; then
		mkdir -p /vault/secret/cacert /vault/logs
		chown -R vault:vault /vault/secret /vault/logs
	fi

	if [ -f "/operator_list.txt" ]; then
		keyshare_count=$(wc -l /operator_list.txt)
	else
		keyshare_count=9
	fi

	if ! find_vault_cacert "$1"; then
		create_vault_cacert "$1"
	fi

	export	VAULT_ADDR="https://127.0.0.1:""$VAULT_BOOTSTRAP_PORT"

	cp -a	"/vault/secret/cacert/root_""$1""_ca.crt"	\
		"$CA_ROOT_DIR""/"

	update-ca-certificates

	start_and_unseal_vault init "$1"

	if [ -d "/tor" ]; then
		try_vanity_address
	fi

	if [ ! -f "/.policies_done" ]; then
		create_vault_policies "$1"
	fi

	kill $server_pid
	wait $server_pid


	export	VAULT_ADDR="https://127.0.0.1:""$VAULT_PORT"
	start_and_unseal_vault bootstrap-db "$1"

	setup_postgres_db

	kill $server_pid
	wait $server_pid
}

init_vault "$PROJECT_NAME"


set +u

if [ -z $1 ]; then
	setcap cap_ipc_lock=+ep $(readlink -f $(which vault))
	chown -R vault:vault /vault/file /vault/logs /vault/secret
	(set -m; start_and_unseal_vault default &>/dev/null; exit) &
	su-exec vault vault server -config="/vault/config/""$PROJECT_NAME"".hcl"
else
	exec "$@"
fi
