FROM hashicorp/vault:1.21.4

RUN apk add --no-cache jq curl ca-certificates

COPY			./conf/*.hcl			/vault/config/
COPY			./policies/*.hcl 		/vault/policies/
COPY			./policies/password/*_pw.hcl 	/vault/policies/password/
COPY			./policies/env/*_wants.env 	/vault/policies/env/
COPY	--chmod=100	./tools/entrypoint.sh		/tools/
COPY	--chmod=600	./tools/inject.sh 		/tools/

ENTRYPOINT ["/tools/entrypoint.sh"]
