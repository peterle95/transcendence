#!/bin/sh

if [ $(vault status | grep Initialized | cut -b 17-) = "true" ]; then
       	if [ $(vault status | grep Sealed | cut -b 17-) = "false" ]; then
		exit 0
	else
		exit 1
	fi
else
	exit 2
fi
