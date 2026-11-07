#!/bin/zsh
# 1枚生成。gen.sh <名前>。<人物>_<表情> は元の人物を参照に渡す。生成元はリポジトリ外の _art_raw/wedding-speech
k=$1; P="$(cd "$(dirname "$0")" && pwd)"; cd "$P/../../_art_raw/wedding-speech"; mkdir -p raw logs; [[ -s raw/$k.png ]] && { echo "$k skip"; exit 0; }
s=1024x1536; case $k in bg|items_a|items_b|centerpiece|garland|flowerwall) s=1536x1024;; me) s=1024x1024;; esac
ref=""; [[ $k == *_* && $k != items_* ]] && ref="raw/${k%_*}.png"
python3 ~/.claude/skills/3d-homepage/scripts/codex_imagegen.py raw/$k.png "$P/prompts/$k.md" ${ref:+$ref} --quality high --size $s > logs/$k.log 2>&1; echo "$k done $?"
