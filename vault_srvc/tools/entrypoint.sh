#!/bin/sh

set -xv

# start server in background
vault server -log-format=json -config=/vault/config/transcendence.hcl 2>&1 1>/vault/logs/vault_log.txt &
server_pid=$!

# wait until its started
until grep started /vault/logs/vault_log.txt
do
	sleep 10
done

# check if keyshares already exists
if [ ! -f "/vault/secret/.keyshares" ]; then # vault was not initialized yet
	vault operator init 2>&1 1>/.vault_operator_init_out.txt

	# unseal vault
	for keyshare in $(grep "Unseal Key " /.vault_operator_init_out.txt | cut -b 15-); do
		curl -X POST --json "{\"key\": \"$keyshare\"}" http://127.0.0.1:8200/v1/sys/unseal
		if [ "$SAVE_UNSEAL_KEYS" = "1" ]; then
			echo $keyshare >> /vault/secret/.keyshares
		fi
	done

	vault_root_token=$(grep "Initial Root Token: " /.vault_operator_init_out.txt | cut -b 21-)
	if [ "$SAVE_ROOT_TOKEN" = "1" ]; then
		echo $vault_root_token > /vault/secret/.root_token
		chmod 400 /vault/secret/.root_token
	fi

	if [ "$SAVE_UNSEAL_KEYS" = "1" ]; then
		chmod 400 /vault/secret/.keyshares
	fi

	shred -u /.vault_operator_init_out.txt
else # vault was already initialized once and the keyshares were saved -> unseal
	while read keyshare; do
		curl -X POST --json "{\"key\": \"$keyshare\"}" http://127.0.0.1:8200/v1/sys/unseal
	done < /vault/secret/.keyshares
fi

wait $server_pid
exit 42
