FROM postgres:15-alpine

RUN apk add --no-cache ca-certificates curl jq

COPY --chmod=100	./tools/entrypoint.sh	/

ENTRYPOINT ["/entrypoint.sh"]
CMD ["postgres"]
