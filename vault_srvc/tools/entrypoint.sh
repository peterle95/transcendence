#!/bin/sh

set -xveu

check_vault_seal ()	{
	if vault status &>/dev/null; then
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
	if [ -f "/vault/secret/cacert/vault-ca.pem" ]; then
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
				vault operator init -key-shares=9 -key-threshold=9 |	\
					while read line; do
					if [ "${line:0:11}" = "Unseal Key " ]; then
						keyshare=${line:14}
						vault operator unseal "$keyshare"
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
				vault operator unseal "$keyshare"
			done < /vault/secret/.keyshares 
		fi

		export VAULT_TOKEN=$(cat /vault/secret/.root_token)
	fi
}

start_and_unseal_vault ()	{
		echo "Starting Vault-$1 Server..."

		vault server	-config=/vault/config/transcendence-$1.hcl	\
				2>/vault/logs/vault-$1_stderr.log		\
				1>/vault/logs/vault-$1_stdout.log		&

		server_pid=$!

		while vault &>/dev/null -eq 1; do
			echo "Waiting for startup..."
			sleep .42
		done

		echo "Vault-$1 server started!"

		try_vault_unseal
}

try_vault_cacert ()	{
	if ! find_vault_cacert; then
		export VAULT_ADDR="http://127.0.0.1:8200"

		start_and_unseal_vault init

		vault policy write cacert /vault/policies/cacert.hcl

		vault secrets enable pki
		vault secrets tune -max-lease-ttl=87600h pki

		vault write -field=certificate pki/root/generate/internal		\
		     common_name="transcendence-backend"				\
		     issuer_name="root-transcendence"					\
		     ttl=87600h > /vault/secret/cacert/root_transcendence_ca.crt

		vault write pki/roles/transcendence-servers allow_any_name=true

		vault write pki/config/urls						\
			issuing_certificates="https://127.0.0.1:8200/v1/pki/ca"		\
			crl_distribution_points="https://127.0.0.1:8200/v1/pki/crl"

		vault secrets enable -path=pki_int pki
		vault secrets tune -max-lease-ttl=43800h pki_int



		vault write -format=json pki_int/intermediate/generate/internal		\
			common_name="transcendence-backend Intermediate Authority"	\
			issuer_name="transcendence-backend-intermediate"		\
			| jq -r '.data.csr' > pki_intermediate.csr

		vault write -format=json pki/root/sign-intermediate			\
			issuer_ref="root-transcendence"					\
			csr=@pki_intermediate.csr					\
			format=pem_bundle ttl="43800h"					\
			| jq -r '.data.certificate' > intermediate.cert.pem

		vault write "pki_int/intermediate/set-signed"				\
			"certificate=@intermediate.cert.pem"

		vault write pki_int/roles/transcendence-backend				\
			issuer_ref="$(vault read -field=default pki_int/config/issuers)"\
			allowed_domains="transcendence-backend"				\
			allow_subdomains=true						\
			allow_bare_domains=true						\
			max_ttl="21900h"


		vault write -format=json pki_int/issue/transcendence-backend		\
			common_name="vault.transcendence-backend"			\
			alt_names="vault_srvc" ttl="21000h"				\
			ip_sans="127.0.0.1"						\
			format="pem_bundle" > tmp.pem.json

		cat tmp.pem.json | jq -r '.data.certificate' > 				\
			/vault/secret/cacert/transcendence-backend-vault.cert
		cat tmp.pem.json | jq -r '.data.private_key' > 				\
			/vault/secret/cacert/transcendence-backend-vault.key

		shred -u tmp.pem.json

		chmod 444 /vault/secret/cacert/transcendence-backend-vault.*
		chown -R vault:vault /vault/secret/cacert

		vault operator seal

		kill $server_pid
		wait $server_pid

		unset	VAULT_ADDR
	fi

	export	VAULT_ADDR="https://127.0.0.1:8200"

	cp -a	/vault/secret/cacert/root_transcendence_ca.crt				\
		/usr/local/share/ca-certificates/

	update-ca-certificates
}

create_vault_policies ()	{
	for policy in $(ls -l /vault/policies/ | tail -n +2 | cut -b 58-); do
		if [ "$policy" != "cacert.hcl" ]; then
			service=${policy:0:-4}
			vault policy write "$service" "/vault/policies/$policy"
			vault write auth/token/roles/"$service"		\
				role_name="$service}"			\
				allowed_entity_aliases="$service"	\
				allowed_policies="$service"		\
				orphan=true				\
				renewable=false				\
				token_no_default_policy=true		\
				token_explicit_max_ttls=999d
			vault token create -role="$service" -policy="$service"
		fi
	done
}

init_vault ()			{
	if [ ! -d "/vault/secret" ]; then
		mkdir -p /vault/secret/cacert /vault/logs
		chown -R vault:vault /vault/secret /vault/logs
	fi

	try_vault_cacert

	start_and_unseal_vault default

	create_vault_policies
}

init_vault

wait $server_pid

#check_vault_seal ()	{
#	vault status -non-interactive &>/dev/null
#	vault_status_exit_code=$?
#	case $vault_status_exit_code in
#		0)
#			echo "Vault unsealed!"
#			return 1
#			;;
#		1)
#			echo "FATAL ERROR: VAULT STATUS: ERROR"
#			exit 2
#			;;
#		2)
#			echo "Vault still sealed!"
#			return 0
#			;;
#	esac
#}
