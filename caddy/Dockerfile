FROM caddy:2.11.1-alpine

RUN	apk add	--no-cache jq curl ca-certificates

COPY	--chmod=400	./conf/Caddyfile	/etc/caddy/

ENTRYPOINT ["sh", "/inject/inject.sh"]
CMD ["su-exec", "caddy", "caddy", "run", "--adapter", "caddyfile", "--config", "/etc/caddy/Caddyfile"]
