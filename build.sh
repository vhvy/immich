#!/bin/bash
cd docker
docker compose -f docker-compose.prod.yml build immich-geo-server
docker tag immich-geo-server ghcr.io/vhvy/immich-geo-server:latest
docker push ghcr.io/vhvy/immich-geo-server:latest

docker compose -f docker-compose.prod.yml build immich-server
docker tag immich-server ghcr.io/vhvy/immich-server:latest
docker push ghcr.io/vhvy/immich-server:latest