FROM hashicorp/vault:1.21.4

RUN apk add --no-cache jq curl ca-certificates

COPY	--chmod=400	./conf/*.hcl			/vault/config/
COPY	--chmod=400	./policies/*.hcl 		/vault/policies/
COPY	--chmod=400	./policies/pw/*_pw.hcl 		/vault/policies/pw/
COPY	--chmod=400	./policies/pw/*_un.hcl 		/vault/policies/pw/
COPY	--chmod=400	./policies/env/*_wants.env 	/vault/policies/env/
COPY	--chmod=100	./tools/entrypoint.sh		/tools/
COPY	--chmod=600	./tools/inject.sh 		/tools/

ENTRYPOINT ["/tools/entrypoint.sh"]
