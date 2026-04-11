#!/bin/sh

set -euo pipefail

check_vault_seal		()	{
	if vault status -non-interactive &>/dev/null; then
		echo "Vault unsealed!"
		return 1
	else
		echo "Vault still sealed!"
		return 0
	fi
}

find_vault_keys			()	{
	if [ -f "/vault/secret/.keys" ]; then
		echo "Vault Keyshares found!"
		return 0
	else
		echo "Could not find Vault Keyshares!"
		return 1 
	fi
}

find_vault_ca_root		()	{
	if [ -f "/vault/secret/ca_root/root_""$PROJECT_NAME""_ca.crt" ]; then
		echo "Vault CA Certificate found!"
		return 0
	else
		echo "Could not find Vault CA Certificate!"
		return 1
	fi
}

generate_initial_secrets	()	{
	vault operator init -key-shares="$key_count" -key-threshold="$key_count"\
       	| while read line; do
		if [ "${line:0:11}" = "Unseal Key " ]; then
			vault operator unseal "${line:14}"
			echo "${line:14}" >> "/vault/secret/.keys"
		elif [ "${line:0:12}" = "Initial Root" ]; then
			echo "${line:20}" > "/vault/secret/.token"
		fi
	done

	chmod 400 "/vault/secret/.keys" "/vault/secret/.token"
}

try_vault_unseal		()	{
	if check_vault_seal; then
		if ! find_vault_keys; then
			if vault operator init -status; then
				echo 	"FATAL_ERROR: VAULT INITIALIZED BUT"	\
					"NO KEYSHARES FOUND"
				exit 1
			else
				&>/dev/null generate_initial_secrets
			fi
		fi

		while read keyshare; do
			vault operator unseal "$keyshare"
		done < /vault/secret/.keys &>/dev/null
	fi

	&>/dev/null export VAULT_TOKEN=$(cat /vault/secret/.token)
}

start_and_unseal_vault		()	{
	echo "Starting Vault-""$PROJECT_NAME"" Server..."

	if [ "$1" != "default" ]; then
		vault server							\
			-config="/vault/config/""$PROJECT_NAME""-""$1"".hcl"	\
			2>"/vault/logs/vault-""$1""_stderr.log"			\
			1>"/vault/logs/vault-""$1""_stdout.log"			&
		server_pid=$!
	fi

	i=0;	set +e
	while :; do
		&>/dev/null vault status -non-interactive; exit_status=$?
		[ $exit_status -eq 1 ] || break

		echo "Waiting for startup... (""$i""s)"

		i=$(( $i + $GRACE_PERIOD ))
		sleep $(( $GRACE_PERIOD ))
	done;	set -e

	echo "Vault-$1 server started! (""$i""s)"

	try_vault_unseal
}

create_vault_intermediate_pki	()	{
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

	onion=""
	if [ "$1" = "$VAULT_NAMESPACE" ]; then
		if [ -f "/vault/secret/ca_root/vault_onion" ]; then
			onion=",""$(cat /vault/secret/ca_root/vault_onion)"
		fi
	elif [ -f "/vault/secret/ca_root/main_onion" ]; then
		onion=",""$(cat /vault/secret/ca_root/main_onion)"
	fi

	vault write "pki_""$1""_int/roles/""$2""-""$1"				\
	issuer_ref="$(vault read -field=default pki_$1_int/config/issuers)"	\
		allowed_domains="$2""-""$1"",""$DOMAIN""$onion"			\
		allow_bare_domains=true						\
		allow_subdomains=true						\
		max_ttl="21900h"

	mkdir -p "/vault/secret/ca_root/bundles/""$2""/""$1"
}

create_vault_root_pki		()	{
	vault policy write ca_root /vault/policies/ca_root.hcl

	vault secrets enable pki
	vault secrets tune -max-lease-ttl=87600h pki

	vault write -field=certificate "pki/root/generate/internal"		\
	     common_name="$PROJECT_NAME"					\
	     issuer_name="root-""$PROJECT_NAME"					\
	     ttl="87600h" > "/vault/secret/ca_root/root_""$PROJECT_NAME""_ca.crt"

	vault write "pki/roles/""$PROJECT_NAME""-servers" allow_any_name=true

	vault write "pki/config/urls"						\
	issuing_certificates="$HTTP""127.0.0.1:""$VAULT_PORT""/v1/pki/ca"	\
	crl_distribution_points="$HTTP""127.0.0.1:""$VAULT_PORT""/v1/pki/crl"

	mkdir -p "/vault/secret/ca_root/bundles/""$PROJECT_NAME"
}

create_vault_ca_root		()	{
	export VAULT_ADDR="http://127.0.0.1:8200"

	start_and_unseal_vault bootstrap

	create_vault_root_pki

	export NAMESPACES="$(for nskv in $(env | grep "NAMESPACE")
					do echo "${nskv#*=}";done)"

	for namespace in $NAMESPACES; do
		create_vault_intermediate_pki "$namespace" "$PROJECT_NAME"
	done &>/dev/null

	mkdir /vault/secret/ca_root/int
	mv *.csr *.pem /vault/secret/ca_root/int

	set +eu
	onion="$([ -n "$ONION_ADDRESS_VAULT" ] && echo -n ,)$ONION_ADDRESS_VAULT"
	set -eu

	vault write -format=json 						\
		"pki_secret_int/issue/""$PROJECT_NAME""-""$VAULT_NAMESPACE"	\
		common_name="vault.""$PROJECT_NAME""-""$VAULT_NAMESPACE"	\
		alt_names="vault_srvc,vault_service""$onion" ttl="21000h"	\
		ip_sans="127.0.0.1,10.133.7.12,10.133.7.17"			\
		client_flag=true server_flag=true				\
		format="pem_bundle" > tmp.pem.json

	cat tmp.pem.json | jq -r '.data.certificate' > 				\
	"/vault/secret/ca_root/""$PROJECT_NAME""-""$VAULT_NAMESPACE""-vault.crt"
	cat tmp.pem.json | jq -r '.data.private_key' > 				\
	"/vault/secret/ca_root/""$PROJECT_NAME""-""$VAULT_NAMESPACE""-vault.key"

	chmod 444								\
	"/vault/secret/ca_root/""$PROJECT_NAME""-""$VAULT_NAMESPACE""-vault.crt"	\
	"/vault/secret/ca_root/""$PROJECT_NAME""-""$VAULT_NAMESPACE""-vault.key"

	chown -R vault:vault /vault/secret/ca_root

	vault operator seal

	kill $server_pid
	wait $server_pid

	unset	VAULT_ADDR
}

setup_pw			()	{
	vault write	"sys/policies/password/""$1""_pw"			\
	policy="@/vault/policies/pw/""$1""_pw.hcl"

	for pw in $(cat "/vault/policies/env/""$1""_wants.env" | grep 'PASSWORD')
	do
		export "$pw""=""$(vault read -field password 			\
		sys/policies/password/"$1"_pw/generate)"
	done
}

setup_un			()	{
	vault write	"sys/policies/password/""$1""_un"			\
	policy="@/vault/policies/pw/""$1""_un.hcl"
	for un in $(cat "/vault/policies/env/""$1""_wants.env" | grep 'USER'); do
		export "$un""=""$(vault read -field password 			\
		sys/policies/password/"$1"_un/generate)"
	done
	export "$(echo $1 | tr '[:lower:]' '[:upper:]')_USER=""$1"
}

setup_jwt			()	{
	#vault write "sys/policies/password/jwt"	\
#	policy="@/vault/policies/pw/jwt_pw.hcl"

#	generate_jwt="vault read -field password\
#	sys/policies/password/jwt/generate"
	generate_jwt="vault write -field=random_bytes \
	sys/tools/random bytes=64 format=base64"

	export "SERVICE_SECRET"="$($generate_jwt)"
	export "AUTH_SECRET"="$($generate_jwt)"
	export "NEXTAUTH_SECRET=""$AUTH_SECRET"
}

setup_share			()	{
	mkdir -p 	"/vault/share/trust/me/bro"
	cd		"/vault/share/trust/me/bro"

	armored_http="${HTTP::-3}"":\/\/"
	sed "s/CHANGE_ME/$armored_http$(hostname)\/v1/g" "/tools/inject.sh" >	\
	"inject.sh"
			
	chmod	100	"inject.sh"

	cd	"../../.."
	mkdir	"ca_root"

	cp	-a	"$CA_ROOT_DIR""/root_""$PROJECT_NAME""_ca.crt" "ca_root"
	chmod	444	"ca_root/root_""$PROJECT_NAME""_ca.crt"
}

generate_san			()	{
	set +eu

	amt="$(printenv $(echo $2 | tr '[:lower:]' '[:upper:]')_AMOUNT)"

	[ "$amt" = 0 ] && amt=1
	[ -z "$3" ] && i=0 || i=$3

	san=""
	while [ $i -ne $amt ]; do

		i=$(( $i + 1 ))

		san=$(echo -n "$2""_srvc"	
		[ $i -ne 1 ] &&	echo -n "_slot""$i";
		echo -n ",""$2""-""$i"".""$PROJECT_NAME""-""$1"",""$2""_service"
		[ $i -ne 1 ] && echo -n "_slot""$i"","
		echo -n "$san")

	done

	onion="$([ -n "$ONION_ADDRESS_MAIN" ] && echo -n ,)$ONION_ADDRESS_MAIN"

	echo -n "$san"",""$DOMAIN""$onion"

	set -eu
}

create_vault_policies		()	{
	setup_jwt

	setup_share

	vault auth enable cert
	vault write "auth/cert/config" enable_metadata_on_failures=true
	vault secrets enable -path secret kv-v2

	date="$(date -u -I)"
	for policy in $(ls -lpr "/vault/policies" | grep -v / | tail -n +2 |
		cut -b 58-); do	service=${policy%.hcl}; mkdir -p "$service"
		[ "$policy" = "ca_root.hcl" ] && continue


		vault policy write "$service" "/vault/policies/""$policy"
		vault write "auth/token/roles/""$service"			\
			role_name="$service"					\
			allowed_entity_aliases="$service"			\
			allowed_policies="$service"				\
			orphan=true						\
			renewable=false	use-limit=1				\
			token_no_default_policy=true				\
			token_explicit_max_ttls="$(($GRACE_PERIOD * 5))s"

		if [ "${service: -5}" = "proxy" ]; then
			net="$REV_PROXY_NAMESPACE"
			subdomain=${service%_proxy}
		elif [ "${service: -2}" = "db" ]; then
			net="$DATABASE_NAMESPACE"
			subdomain=${service%_db}
		else
			net="$SERVICE_NAMESPACE"
			subdomain=${service%_srvc}
		fi
		if [ "${service::2}" = "ai" ]; then
			net="$AI_NAMESPACE"
		fi

		cn="$subdomain"".""$PROJECT_NAME""-""$net"
		san="$(generate_san $net $subdomain)"

		vault write -format=json					\
			"pki_""$net""_int/issue/""$PROJECT_NAME""-""$net"	\
			common_name="$cn" alt_names="$san"			\
			key_type="ed25519" signature_bits=512		\
			ttl="21000h" client_flag=true server_flag=true		\
			format="pem_bundle" > pem.json

		cat pem.json | jq -r '.data.certificate' > "$service""/cert.pem"
		cat pem.json | jq -r '.data.private_key' > "$service""/key.pem"

		bundles="/vault/secret/ca_root/bundles/""$PROJECT_NAME""/""$net"
		mv	"pem.json"	"$bundles""/""$subdomain""-""$date"".bak"

		vault write "auth/cert/certs/""$service"			\
			token_policies="$service"				\
			certificate="@""$service""/cert.pem"

		tmp="$subdomain"

		[ "$tmp" != "ai" ] && [ "$net" != "$DATABASE_NAMESPACE" ] &&	\
		[ "$tmp" != "dark" ] &&						\
		export COLLECTION_CORS="$HTTP""$cn"",""$COLLECTION_CORS"

		[ -f "/vault/policies/pw/""$tmp""_pw.hcl" ] && setup_pw "$tmp"
		[ -f "/vault/policies/pw/""$tmp""_un.hcl" ] && setup_un "$tmp"

		if [ -f "/vault/policies/env/""$subdomain""_wants.env" ]; then
			i=1
			if [ "$tmp" = "ai" ]; then
				i=$(( $AI_AMOUNT + 1 ))
				subdomain="$subdomain""-""$i"
			fi
			while [ $i -ne 0 ]; do
				env_bundle=$(create_env_bundle "$tmp" $i)
				vault kv put -mount "secret"	\
				"$subdomain""/env" "env""=""$env_bundle"
				i=$(( $i - 1 ))
				subdomain="$tmp""-""$i"
				echo $env_bundle
			done
		fi
	done
}

try_vanity_address		()	{
	sleep $(( $GRACE_PERIOD * 3 + 2))
	if [ ! -d /tor/x* ]; then
		return
	fi
	set +e
	i=0
	while [ ! -d "/tor/onion_service" ]; do
		echo "waiting for address ""$VANITY_ADDRESS_MAIN""...d.onion"	\
		"to be generated... ""$i""s"
		sleep $(( $GRACE_PERIOD ))
		i=$(( i + $GRACE_PERIOD ))

		mv "/tor/""$VANITY_ADDRESS_MAIN"* /tor/onion_service
		cp /tor/onion_service/hostname /vault/secret/ca_root/main_onion
		chmod -R 700 /tor
		chown -R 100:101 /tor
	done
	export ONION_ADDRESS_MAIN=$(cat /vault/secret/ca_root/main_onion)
	while [ ! -d "/tor/other_onion_service" ]; do
		echo "waiting for address ""$VANITY_ADDRESS_VAULT""...d.onion)"	\
		"to be generated... ""$i""s"
		sleep $(( $GRACE_PERIOD ))
		i=$(( i + $GRACE_PERIOD ))
		mv "/tor/""$VANITY_ADDRESS_VAULT"* /tor/other_onion_service
		mkdir -p /tor/other_onion_service/authorized_clients
		cp /tor/onion_service/hostname /vault/secret/ca_root/vault_onion
		chmod -R 700 /tor
		chown -R 100:101 /tor
	done
	export ONION_ADDRESS_VAULT=$(cat /vault/secret/ca_root/vault_onion)
	export ADD_HEADER="add_header"
	export ONION_LOCATION="Onion-Location"
	export REQUEST_URI="\$request_uri;"
	rm -rf	"/tor/""$VANITY_ADDRESS_MAIN"*	\
		"/tor/""$VANITY_ADDRESS_VAULT"*
	if [ "${VANITY_ADDRESS_MAIN::1}" != "x" ]\
	&& [ "${VANITY_ADDRESS_VAULT::1}" != "x" ]
	then	rm 	-rf	"/tor/x"*;	fi
	set -e
}

setup_postgres_db		()	{
	vault secrets enable database

	while [ "$(vault kv get -mount secret -field init postgres/init)"	\
	!= "true" ]; do
		echo "waiting for postgres to setup the initial database..."
		sleep $(( $GRACE_PERIOD ))
	done 2>/dev/null

	sleep $(( $GRACE_PERIOD * 4 ))
	vault write "database/config/""$GAME_DB"				\
		plugin_name="postgresql-database-plugin"			\
		allowed_roles="$GAME_DB""_game"					\
		connection_url="postgresql://{{username}}:{{password}}@postgres.""$PROJECT_NAME""-""$DATABASE_NAMESPACE"":""$POSTGRES_PORT""/""$GAME_DB"\
		username="$POSTGRES_USER_VAULT_GAME"				\
		password="$POSTGRES_PASSWORD_VAULT_GAME"			\
		password_authentication="scram-sha-256"				\
		password_policy="postgres_pw"

	vault write "database/config/""$AUTH_DB"				\
		plugin_name="postgresql-database-plugin"			\
		allowed_roles="$AUTH_DB""_auth"					\
		connection_url="postgresql://{{username}}:{{password}}@postgres.""$PROJECT_NAME""-""$DATABASE_NAMESPACE"":""$POSTGRES_PORT""/""$AUTH_DB"\
		username="$POSTGRES_USER_VAULT_AUTH"				\
		password="$POSTGRES_PASSWORD_VAULT_AUTH"			\
		password_authentication="scram-sha-256"				\
		password_policy="postgres_pw"

	vault write "database/roles/""$AUTH_DB""_auth" db_name="$AUTH_DB"	\
		creation_statements="						\
		CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}';	\
		GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";	\
		GRANT DELETE ON ALL TABLES IN SCHEMA public TO \"{{name}}\";	\
		GRANT CREATE ON SCHEMA public TO \"{{name}}\";"

	vault write "database/roles/""$GAME_DB""_game" db_name="$GAME_DB"	\
		creation_statements="						\
		CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}';	\
		GRANT SELECT ON ALL TABLES IN SCHEMA public TO \"{{name}}\";	\
		GRANT DELETE ON ALL TABLES IN SCHEMA public TO \"{{name}}\";	\
		GRANT CREATE ON SCHEMA public TO \"{{name}}\";"
}

create_env_bundle		()	{
	if [ "$1" = "ai" ]; then
		echo " AI_SLOT=""$(( $2 ))"
	fi
	for key in $(cat "/vault/policies/env/""$1""_wants.env"); do
		case $key in
			"ONION_ADDRESS_"*"_HEADER")
				if [ -f "/vault/secret/ca_root/main_onion" ] &&
				[ -f "/vault/secret/ca_root/main_onion" ]; then
				echo " $key""=""$HTTP""$(printenv ${key%_HEADER})"
				fi
				;;
			"NGINX_TCP" | "NGINX_TLS" | "NGINX_UDP")
				tmp="$(printenv $key)"
				[ "$key" != "NGINX_TCP" ] && tmp="${tmp%%/*}"
				echo " $key""=""${tmp#*:}"
				;;
			"CORS_ALLOWED_ORIGIN" | "PUBLIC_URL" |			\
			"SOCKET_IO_ALLOWLIST" | "CHAT_WS_CORS" | "GAME_WS_CORS"	\
			| "AUTH_CORS")
				echo " $key""=""$COLLECTION_CORS"
				;;
			"INTERNAL_SERVICE_SECRET")
				echo " $key""=""$SERVICE_SECRET"
				;;
			"AI_LOG_LEVEL")
				echo " LOG_LEVEL""=""$AI_LOG_LEVEL"
				;;
			"GAME_SOCKET_PORT" | "SOCKET_PORT" | "GAME_WS_PORT")
				echo " $key""=""$GAME_WS_PORT"
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
			"PGSSLROOTCERT" | "NODE_EXTRA_CA_CERTS" | "ROOTCERT")
				echo						\
			" $key""=""$CA_ROOT_DIR""/root_""$PROJECT_NAME""_ca.crt"
				;;
			"NEXTAUTH_URL") ## SANITY CHECK SSL ## BREAKS TOKEN IF HTTPS
				echo " $key""=""http://""$DOMAIN""$AUTH_PATH"
				;;
			"NEXT_PUBLIC_AUTH_SERVICE_URL")
				echo " $key""=""$AUTH_PATH"
				;;
			"NEXT_PUBLIC_GAME_SERVICE_URL")
				echo " $key""=""$GAME_PATH"
				;;
			"NEXT_PUBLIC_CHAT_SERVICE_URL")
				echo " $key""=""$CHAT_PATH"
				;;
			"GAME_WS_PATH" | "CHAT_WS_PATH" | "SOCKET_PATH")
				echo " $key""=""$SOCKET_PATH"
				;;
			"PGDATADIR")
				echo " $key""=""$POSTGRES_DATA_DIR"
				;;
			"GAME_SVC_URL")
				echo						\
" $key""=""$HTTP""game.""$PROJECT_NAME""-""$SERVICE_NAMESPACE"":""$GAME_WS_PORT"
				;;
			"MONGODB_URI" | "CHAT_DB_URL")
				echo " $key""=""mongodb://mongo.""$PROJECT_NAME""-""$DATABASE_NAMESPACE"":""$MONGO_PORT""/""$CHAT_DB"
				;;
			"AUTH_SERVICE_URL" | "NEXTAUTH_URL_INTERNAL")
				echo " $key""=""$HTTP""auth.""$PROJECT_NAME""-""$SERVICE_NAMESPACE"":""$AUTH_PORT"
				;;
			*)
				echo " $key""=""$(printenv "$key")"
				;;
		esac
	done
}



bootstrap_vault		()	{
	if [ ! -d "/vault/secret" ]; then
		mkdir -p /vault/secret/ca_root /vault/logs
		chown -R vault:vault /vault/secret /vault/logs
	fi

	if [ -f "/operator_list.txt" ]; then
		key_count=$(wc -l /operator_list.txt)
	else
		key_count=9
	fi

	try_vanity_address

	if ! find_vault_ca_root; then
		create_vault_ca_root
	fi

	unset	VAULT_ADDR

	cp -a	"/vault/secret/ca_root/root_""$PROJECT_NAME""_ca.crt"		\
		"$CA_ROOT_DIR""/"

	update-ca-certificates
}

init_secrets		()	{

	start_and_unseal_vault init 

	set +eu
	httponion="$([ -n "$ONION_ADDRESS_MAIN" ] && \
	echo -n ,$HTTP)$ONION_ADDRESS_MAIN"
	export COLLECTION_CORS="$HTTP""$DOMAIN""$httponion"
	set -eu

	create_vault_policies

	kill $server_pid
	wait $server_pid

	export	VAULT_ADDR="https://127.0.0.1:""$VAULT_PORT"
	start_and_unseal_vault bootstrap-db

	setup_postgres_db

	kill $server_pid
	wait $server_pid

	touch "/vault/.done"
}

check_done			()	{
	if [ ! -f "/vault/.done" ]; then
		if [ -f "/vault/.started" ]; then
			echo 	"FATAL ERROR: vault previously failed to"	\
			       	"setup, please delete volume and rebuild"
			exit 42
		fi

		touch "/vault/.started"

		bootstrap_vault

		init_secrets
	fi
}


main				()	{

	###	paths to certificates, will break if changed	###
	export CA_ROOT_DIR=/usr/local/share/ca-certificates
	export CERT_PATH=/certs/cert.pem
	export KEY_PATH=/certs/key.pem

	check_done

	set +u

	if [ -z $1 ]; then

		cp -a	"/vault/secret/ca_root/root_""$PROJECT_NAME""_ca.crt"	\
			"$CA_ROOT_DIR""/"

		update-ca-certificates

		export VAULT_ADDR="https://127.0.0.1:""$VAULT_PORT"

		setcap cap_ipc_lock=+ep $(readlink -f $(which vault))

		chown -R vault:vault						\
			/vault/file /vault/logs /vault/secret /vault/config

		(set -m; start_and_unseal_vault default &>/dev/null; exit) &

		su-exec vault vault server					\
			-config="/vault/config/""$PROJECT_NAME"".hcl"
	else
		exec "$@"
	fi
}

main "$@"
