FROM alpine:3.23

RUN apk add --no-cache	tor
#			su-exec		\
#			curl		\
#			ca-certificates	\
#			&& rm /etc/tor/*

COPY --chmod=400 --chown=tor:tor ./conf/torrc	/etc/tor/
#COPY --chmod=100   ./tools/entrypoint.sh	/

#ENTRYPOINT ["/entrypoint.sh"]

#CMD ["su-exec", "tor", "/usr/bin/tor"]

USER	tor

CMD ["tor"]
