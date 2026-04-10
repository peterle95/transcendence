FROM nginx:1.28.3-alpine3.23-slim

RUN	apk add --no-cache jq curl ca-certificates

ENTRYPOINT ["/bin/sh", "/inject/inject.sh"]

CMD ["nginx", "-g daemon off;"]
