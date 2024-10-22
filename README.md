VS code extension for the [lotus](https://github.com/symil/lotus) programming language.

## How to install

0. Install the [lotus compiler](https://github.com/symil/lotus).

1. Clone this repository in the VS code extension directory. On Linux, this is `$HOME/.vscode/extensions`.

```sh
git clone git@github.com:symil/lotus-vscode.git ~/.vscode/extensions
```

2. Compile the extension.

```sh
cd ~/.vscode/extensions/vscode-lotus
npm install
npm run compile
```

3. Copy the lotus compiler in the `server` directory of the extension.

```sh
cp /path/to/lotus/target/release/lotus-compiler ~/.vscode/extensions/vscode-lotus/server
```

4. Reload VS code.

5. (Optional) In the VS code settings, set the icon theme to "Seti + Lotus".