FROM hashicorp/vault:1.21.4

RUN apk add --no-cache jq curl

COPY			./conf/transcendence.hcl 	/vault/config/transcendence.hcl
COPY			./policies/ 			/vault/policies
COPY	--chmod=555	./tools/healthcheck.sh		/healthcheck.sh
COPY	--chmod=555	./tools/entrypoint.sh 		/entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
