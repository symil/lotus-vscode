#!/bin/bash

SOURCE_DIR="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
SOURCE_DIR_NAME=$(basename $SOURCE_DIR)
TARGET_DIR="$HOME/.vscode/extensions"

rm -rf "$TARGET_DIR/$SOURCE_DIR_NAME"
rsync -a --exclude=".git*" $SOURCE_DIR $TARGET_DIR