VS code extension for the [lotus](https://github.com/symil/lotus) programming language that provides syntax highlighting & autocompletion.

## How to install

- Install the [lotus compiler](https://github.com/symil/lotus).

- Clone this repository in the VS code extension directory. On Linux & Mac, this is `$HOME/.vscode/extensions`. On Windows this is `%USERPROFILE%\.vscode\extensions`.

```sh
git clone git@github.com:symil/lotus-vscode.git ~/.vscode/extensions
```

- Compile the extension:

```sh
cd ~/.vscode/extensions/vscode-lotus
npm install
npm run compile
```

- Copy the lotus compiler in the `server` directory of the extension:

```sh
cp /path/to/lotus/target/release/lotus-compiler ~/.vscode/extensions/vscode-lotus/server
# On Windows, the executable is named `lotus-compiler.exe`.
```

- Reload VS code.

- (Optional) In the VS code settings, set the icon theme to "Seti + Lotus".
