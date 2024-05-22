# [1.0.0-beta.2](https://github.com/TomokiMiyauci/esbuild-deno-specifier/compare/1.0.0-beta.1...1.0.0-beta.2) (2024-05-21)


### Features

* **browser:** change custom resolve interface, improve browser field resolution algorithm ([b3f0806](https://github.com/TomokiMiyauci/esbuild-deno-specifier/commit/b3f08063e2683ef96d5cf682a56ecf675cbe4bd9))
* **strategy:** change the way npm module seaches for package url ([b7b5a5e](https://github.com/TomokiMiyauci/esbuild-deno-specifier/commit/b7b5a5eaafc495e0ab6f37ff2b5c7eb90d10233e))

# 1.0.0-beta.1 (2024-05-21)


### Features

* **cjs:** improve error message ([927dc38](https://github.com/TomokiMiyauci/esbuild-deno-specifier/commit/927dc3857a93a89771e9bdd2417ea0baa4b89312))
* limit the scope of package search ([36b006f](https://github.com/TomokiMiyauci/esbuild-deno-specifier/commit/36b006fd90249b408e36a0d49dc40efd7cfd5f9c))
* **plugin:** add load hook for data url ([3ec5043](https://github.com/TomokiMiyauci/esbuild-deno-specifier/commit/3ec5043805ab69b980a32b183a7fa54e08d89aaa))
* **plugin:** add npm local and global scope option ([1c9fcb5](https://github.com/TomokiMiyauci/esbuild-deno-specifier/commit/1c9fcb55195ca277f83315910e5a4f82d7f99b1e))
* **plugin:** change plugin interface to remove npm options ([72ff916](https://github.com/TomokiMiyauci/esbuild-deno-specifier/commit/72ff916a35819032d9faa7a709a96c9fcea5767b))
* **plugin:** rename plugin ([4ccc969](https://github.com/TomokiMiyauci/esbuild-deno-specifier/commit/4ccc9696c6b62879062b3567da44edf0a7a97910))
* **plugin:** treat log level ([a948b13](https://github.com/TomokiMiyauci/esbuild-deno-specifier/commit/a948b1307e0689b466042d25d01c04f4d63159de))
* **resolve:** add throwing error if use node built-in module if platform is not `node` ([72ca1e4](https://github.com/TomokiMiyauci/esbuild-deno-specifier/commit/72ca1e4877e08d829e9ddf6a3345d8ccca0fe19f))
* **resolve:** detect sideEffects from package.json ([e59fcb0](https://github.com/TomokiMiyauci/esbuild-deno-specifier/commit/e59fcb04d71acf87776ac16bfc0f272f7e34764d))
* **src:** add global and local strategy ([da86aee](https://github.com/TomokiMiyauci/esbuild-deno-specifier/commit/da86aee888c560d382f114115e30fbe47e218532))