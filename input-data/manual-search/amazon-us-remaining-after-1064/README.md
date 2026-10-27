# Amazon.com slow VPS batch: after input 1,064

The ten input files are ordered slices of the original input positions 1,065–5,647. The original input, earlier chunks and earlier outputs are unchanged. Duplicate ISBNs are retained by input position. See manifest.json for exact ranges and SHA-256 hashes. The first 1,064 are considered processed, including unsuccessful and blocked records; they are not necessarily verified.

The local run may still be advancing beyond position 1,064. Stop it before starting these chunks if you want to prevent additional duplicate work. If it has already progressed beyond 1,064, those later items are present in the chunks by design.

The bundle contains the Amazon scraper code current at preparation, shared utilities, input files and a `run-amazon-us-remaining.sh` launcher. It does not contain credentials, browser profiles, existing results or node_modules. On each VPS, extract the bundle into a NEW directory. If `/root/book_listing_automator/node_modules` and the Playwright browser are already installed, use the dependency symlink in the example below. Otherwise install the project dependencies and Playwright Chromium in that new directory before running.

Example (VPS 2, chunk 01):

```sh
# On the Mac, from the project directory:
scp output/amazon-us-isbn/remaining-after-1064-vps-bundle.tar.gz root@69.164.249.174:/root/

# On VPS 2:
mkdir -p /root/amazon-us-remaining-after-1064
cd /root/amazon-us-remaining-after-1064
tar -xzf /root/remaining-after-1064-vps-bundle.tar.gz
ln -s /root/book_listing_automator/node_modules node_modules
tmux new -s amazon-slow-01
./run-amazon-us-remaining.sh 01
```

Detach without stopping the job: Ctrl+B, then D. Reattach with `tmux attach -t amazon-slow-01`. Repeat on VPS 3–11 with chunk numbers 02–10 respectively. Each run writes `output/amazon-us-isbn/remaining-after-1064/chunk-NN.jsonl` in this new directory. Rerun the same command to resume; don't delete or change its input/output pairing. There is no automatic retry loop.

`--slow` sets 4–10 seconds between page requests AND between ISBNs, doubles the normal ranges, starts transient backoff at 60 seconds, pauses at the first block and waits at least 30 minutes before a manual restart. Longer Retry-After values are respected. No setting guarantees Amazon will allow requests. Ten concurrent VPS jobs increase total request volume; consider starting one job first and check for blocks before starting more.
