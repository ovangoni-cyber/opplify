#!/bin/bash
set -e
cd /opt/opplify
git pull origin master
docker compose up -d --build
