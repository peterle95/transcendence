#!/bin/bash

set -euo pipefail

update-ca-certificates&&api="https://vault.transcendence-secret/v1";export $(2>/dev/null curl --cert /certs/cert.pem --key /certs/key.pem -H "X-Vault-Token: ""$(2>/dev/null curl -X POST --cert /certs/cert.pem --key /certs/key.pem "$api""/auth/cert/login"|jq -r '.auth.client_token')" "$api""/secret/data/""$(echo ${HOSTNAME%$(dnsdomainname)}|sed 's/\./\//')""env"|jq -r ".data.data|to_entries|map(\"\(.key)=\(.value|tostring)\")|.[]")

if [ ! -f "$POSTGRES_DATA_DIR""/pg_hba.conf" ]; then

	2>/dev/null	echo "$POSTGRES_PASSWORD" >			"/.pwfile"
	&>/dev/null	chown	"$POSTGRES_USER":"$POSTGRES_USER"	"/.pwfile"
	&>/dev/null	chmod	400					"/.pwfile"

	(set -m; su-exec "$POSTGRES_USER"	initdb				\
					--auth="scram-sha-256"			\
					--auth-local="scram-sha-256"		\
					--auth-host="scram-sha-256"		\
					--data-checksums	--no-locale	\
					--pwfile="/.pwfile"			)

	(su-exec $POSTGRES_USER postgres &)
	pid=$?

	shred -uf "/.pwfile"
	pushd	"$POSTGRES_DATA_DIR"

	sleep 1
	psql -v ON_ERROR_STOP=1 "postgresql://""$POSTGRES_USER"":""$POSTGRES_PASSWORD""@127.0.0.1:""$PGPORT" <<-EOSQL
		-- Auth Service Database
		CREATE USER ${POSTGRES_USER_VAULT_AUTH} WITH PASSWORD '${POSTGRES_PASSWORD_VAULT_AUTH}' SUPERUSER;
		CREATE DATABASE ${AUTH_DB};
		GRANT ALL PRIVILEGES ON DATABASE ${AUTH_DB} TO ${POSTGRES_USER_VAULT_AUTH};
		CREATE USER ${POSTGRES_USER_VAULT_GAME} WITH PASSWORD '${POSTGRES_PASSWORD_VAULT_GAME}' SUPERUSER;
		CREATE DATABASE ${GAME_DB};
		GRANT ALL PRIVILEGES ON DATABASE ${GAME_DB} TO ${POSTGRES_USER_VAULT_GAME};
	EOSQL
	kill -9 $pid

	cp /certs/*.pem						.
	chmod	600						*pem
	chown	"$POSTGRES_USER":"$POSTGRES_USER"		*pem
	if [ "$HTTP" = "https://" ]; then
		echo "ssl = 'on'"			>>	postgresql.conf
		echo "ssl_key_file = 'key.pem'"		>>	postgresql.conf
		echo "ssl_cert_file = 'cert.pem'"	>>	postgresql.conf
		echo "ssl_ca_file = '"$CA_ROOT_DIR"/root_"$PROJECT_NAME"_ca.crt'" \
		>> postgresql.conf
	fi

	rm -f "$POSTGRES_DATA_DIR""/pg_hba.conf"
	echo "hostssl "$GAME_DB" all 133.7.42.16/28 scram-sha-256 " \
	>>	pg_hba.conf
	echo "hostssl "$AUTH_DB" all 133.7.42.16/28 scram-sha-256" \
	>>	pg_hba.conf

	2>/dev/null curl --cert /certs/cert.pem --key /certs/key.pem -H "X-Vault-Token: ""$(2>/dev/null curl -X POST --cert /certs/cert.pem --key /certs/key.pem "$api""/auth/cert/login"|jq -r '.auth.client_token')" "$api""/secret/data/""$(echo ${HOSTNAME%$(dnsdomainname)}|sed 's/\./\//')""init" --json '{ "data": { "init": "true" } }'

	popd
fi

su-exec "$POSTGRES_USER" "$@"
