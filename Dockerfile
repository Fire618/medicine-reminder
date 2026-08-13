FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y curl ca-certificates git nodejs npm && \
    rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://opencode.ai/install | bash

ENV PATH="/root/.opencode/bin:${PATH}"

WORKDIR /workspace

CMD ["bash"]
