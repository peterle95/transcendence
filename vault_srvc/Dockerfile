FROM hashicorp/vault:1.21.4

RUN apk add --no-cache jq curl ca-certificates

COPY			./conf		 	/vault/config
COPY			./policies 		/vault/policies
COPY	--chmod=500	./tools/entrypoint.sh 	/entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
