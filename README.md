<div align="center">
<h1>parse-nested-form-data</h1>

<p>Parse FormData into nested objects and arrays, based on the field names</p>
</div>

---

<!-- prettier-ignore-start -->
[![Build Status][build-badge]][build]
[![Code Coverage][coverage-badge]][coverage]
[![version][version-badge]][package]
[![Size][size-badge]][size]
[![downloads][downloads-badge]][npmtrends]
[![MIT License][license-badge]][license]
[![All Contributors][all-contributors-badge]](#contributors-)
[![PRs Welcome][prs-badge]][prs]
[![Code of Conduct][coc-badge]][coc]
<!-- prettier-ignore-end -->

A form sends flat name-value pairs. This library turns them into nested objects
and arrays, with numbers, booleans and `null`. The field names tell it how.

```html
<form method="post">
  <input name="user.name" value="Ada" />
  <input name="+user.age" value="36" />
  <input name="&user.admin" type="checkbox" checked />
  <input name="tags[]" value="math" />
  <input name="tags[]" value="code" />
</form>
```

```ts
parseFormData(formData)
// {
//   user: {name: 'Ada', age: 36, admin: true},
//   tags: ['math', 'code'],
// }
```

It's under 2 kB (minified and brotli-compressed), has no dependencies and works
in all modern JavaScript runtimes (see
[Supported runtimes](#supported-runtimes)).

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Install](#install)
- [Usage](#usage)
- [Field names](#field-names)
  - [Numbers](#numbers)
  - [Booleans](#booleans)
  - [Null](#null)
  - [Arrays](#arrays)
  - [Objects](#objects)
  - [Files](#files)
- [API](#api)
  - [parseFormData(formData, options?)](#parseformdataformdata-options)
    - [formData](#formdata)
    - [options](#options)
      - [removeEmptyString](#removeemptystring)
      - [depth](#depth)
      - [transformEntry](#transformentry)
- [Errors](#errors)
- [Security](#security)
- [Supported runtimes](#supported-runtimes)
- [Issues](#issues)
  - [🐛 Bugs](#-bugs)
  - [💡 Feature Requests](#-feature-requests)
- [Contributors ✨](#contributors-)
- [LICENSE](#license)
- [Special Thanks](#special-thanks)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Install

```sh
npm install parse-nested-form-data
```

## Usage

```ts
import {parseFormData} from 'parse-nested-form-data'

const data = parseFormData(await request.formData())
```

`parseFormData` reads each entry, puts its value at the place its name tells,
and returns a new object. The input stays unchanged.

## Field names

| In the name      | Meaning                              | Name and value | Result          |
| ---------------- | ------------------------------------ | -------------- | --------------- |
| `.key`           | A key in an object                   | `a.b` = `x`    | `{a: {b: 'x'}}` |
| `[key]`          | A key in an object, same as `.key`   | `a[b]` = `x`   | `{a: {b: 'x'}}` |
| `[]`             | Add the value to the end of an array | `a[]` = `x`    | `{a: ['x']}`    |
| `[0]`, `[1]`, …  | Put the value at this array position | `a[0]` = `x`   | `{a: ['x']}`    |
| `+` at the start | Change the value to a number         | `+a` = `36`    | `{a: 36}`       |
| `&` at the start | Change the value to a boolean        | `&a` = `on`    | `{a: true}`     |
| `-` at the start | Change the value to `null`           | `-a` = `x`     | `{a: null}`     |

You can combine them, for example `+orders[0].items[].price`.

In this README, the name without its `+`, `&` or `-` is the **path**. Each
`key`, `.key`, `[key]`, `[]` and `[0]` in it is a **path part**: `a.b[0]` has
three path parts.

### Numbers

A name that starts with `+` changes the value with `Number(value)`. A value that
isn't a number gives `NaN`. An empty string gives `0`.

```ts
const formData = new FormData()
formData.append('+a', '1')
formData.append('+b', '1.5')
formData.append('+c', 'x')
parseFormData(formData)
// {a: 1, b: 1.5, c: NaN}
```

### Booleans

A name that starts with `&` changes the value to a boolean. The value `on`,
`true` or any number other than `0` gives `true`. All other values give `false`.

```ts
const formData = new FormData()
formData.append('&a', 'on')
formData.append('&b', 'true')
formData.append('&c', '1')
formData.append('&d', 'off')
formData.append('&e', 'false')
formData.append('&f', '0')
parseFormData(formData)
// {a: true, b: true, c: true, d: false, e: false, f: false}
```

A checkbox sends `on` when it's checked. When it isn't checked, the browser
sends nothing, so the key is missing from the result.

### Null

A name that starts with `-` changes the value to `null`, whatever the value is.

```ts
const formData = new FormData()
formData.append('-a', 'x')
parseFormData(formData)
// {a: null}
```

### Arrays

`[]` adds the value to the end of the array, in the order of the entries:

```ts
const formData = new FormData()
formData.append('a[]', '1')
formData.append('a[]', '2')
parseFormData(formData)
// {a: ['1', '2']}
```

`[0]`, `[1]`, … put the value at that position. The order of the entries doesn't
matter. Gaps are removed, so `a[1]` and `a[5]` give an array of two values:

```ts
const formData = new FormData()
formData.append('a[5]', 'second')
formData.append('a[1]', 'first')
parseFormData(formData)
// {a: ['first', 'second']}
```

One array can't use both `[]` and `[0]`. That throws a `MixedArrayError`.

The largest position is `4294967294`, the largest index a JavaScript array can
hold. A larger number throws an `InvalidPathError`.

Arrays can hold objects and other arrays:

```ts
const formData = new FormData()
formData.append('a[0].b', '1')
formData.append('a[1].b', '2')
formData.append('c[0][]', '3')
formData.append('c[0][]', '4')
formData.append('c[1][]', '5')
parseFormData(formData)
// {a: [{b: '1'}, {b: '2'}], c: [['3', '4'], ['5']]}
```

### Objects

`.key` and `[key]` mean the same thing, so `a.b` and `a[b]` are the same key.
Only digits in brackets (`[0]`) make an array. You can mix both forms with each
other and with arrays:

```ts
const formData = new FormData()
formData.append('a[b]', '1')
formData.append('a.c[0].d', '2')
formData.append('a[c][1][d]', '3')
parseFormData(formData)
// {a: {b: '1', c: [{d: '2'}, {d: '3'}]}}
```

The text in brackets is the key exactly as written. It can contain `.`, `[` and
`]`, if the brackets inside are balanced:

```ts
const formData = new FormData()
formData.append('a[b.c]', '1')
formData.append('a[d[e]]', '2')
parseFormData(formData)
// {a: {'b.c': '1', 'd[e]': '2'}}
```

Brackets in the wrong place don't cause an error:

- A `[` without a matching `]` stays in the key. `a[[0]` is the key `[0` in `a`.
  `a[0` is the key `a[0`.
- A `]` without a matching `[` stays in the key. `a]b` is the key `a]b`.
- Text after `]` starts the next key. `a[0]b` is the same as `a[0].b`.
- Empty keys are skipped. `a..b` and `a.[b]` are the same as `a.b`, and `[a]` is
  the same as `a`.

### Files

`File` values stay as they are. This includes native files and files from a
polyfill such as `@remix-run/web-file`. A file is always the end of a path:

```ts
const formData = new FormData()
formData.append('avatar', new File(['...'], 'avatar.png'))
parseFormData(formData)
// {avatar: File}

formData.append('avatar.name', 'me.png')
parseFormData(formData)
// throws DuplicateKeyError('avatar')
```

## API

### parseFormData(formData, options?)

Returns a new object with the parsed values.

#### formData

Type: `Iterable<[string, string | File]>`

A `FormData` object, or any other list of `[name, value]` pairs, for example
`[['a.b', 'x']]` or a `URLSearchParams` object.

#### options

Type: `object`

##### removeEmptyString

Type: `boolean`\
Default: `false`

Skip all entries whose value is an empty string (`''`).

```ts
const formData = new FormData()
formData.append('a', '')
formData.append('b', 'x')
parseFormData(formData, {removeEmptyString: true})
// {b: 'x'}
```

##### depth

Type: `number`\
Default: `Infinity`

The maximum number of path parts in one path. All parts count, so `a.b[0]` and
`a[b][]` both have three. A longer path throws a [`DepthLimitError`](#errors).
The value must be a positive integer or `Infinity`. Other values throw a
`TypeError`.

```ts
const formData = new FormData()
formData.append('user.address.street', 'Main St')
parseFormData(formData, {depth: 3})
// {user: {address: {street: 'Main St'}}}

formData.append('user.address.geo.lat', '52.5')
parseFormData(formData, {depth: 3})
// throws DepthLimitError('user.address.geo.lat')
```

The parser can handle any depth. But a field like `a.a.a…` with thousands of
parts makes an object that crashes code that walks it recursively, for example
`JSON.stringify`, validators or deep clones. If the input comes from untrusted
clients, set a limit. `depth: 32` is enough for almost every form. Version 2.0
will change the default to a smaller number.

The depth is checked after `transformEntry`. An entry that `removeEmptyString`
skips is never checked.

##### transformEntry

Type:
`(entry: [path: string, value: string | File], defaultTransform) => {path: string, value: string | number | boolean | null | File}`\
Default:
the built-in transform for `+`, `&` and `-`

Changes each entry before it's parsed. It gets the entry as `[name, value]` and
the built-in transform. It must return the path and the value for the result.
Call `defaultTransform(entry)` to keep `+`, `&` and `-` working:

```ts
const formData = new FormData()
formData.append('a', 'x')
formData.append('+b', '1')
parseFormData(formData, {
  transformEntry: (entry, defaultTransform) => {
    const {path, value} = defaultTransform(entry)
    return {
      path,
      value: typeof value === 'string' ? value.toUpperCase() : value,
    }
  },
})
// {a: 'X', b: 1}
```

## Errors

`parseFormData` stops at the first error. All error classes are exported:

```ts
import {
  DepthLimitError,
  DuplicateKeyError,
  ForbiddenKeyError,
  InvalidPathError,
  MixedArrayError,
} from 'parse-nested-form-data'
```

| Error               | Thrown when                                                              | Example names                            |
| ------------------- | ------------------------------------------------------------------------ | ---------------------------------------- |
| `DuplicateKeyError` | Two entries set the same path, or use a path part in two different ways. | `a` and `a`; `a` and `a.b`; `a.b`, `a[]` |
| `MixedArrayError`   | One array uses both `[]` and `[0]`.                                      | `a[]` and `a[0]`                         |
| `ForbiddenKeyError` | A path part is `__proto__`, `constructor` or `prototype`.                | `__proto__.x`; `a[constructor]`          |
| `DepthLimitError`   | A path has more path parts than the `depth` option allows.               | `a.b.c` with `depth: 2`                  |
| `InvalidPathError`  | An array position is larger than `4294967294`.                           | `a[4294967295]`                          |
| `TypeError`         | The `depth` option isn't a positive integer or `Infinity`.               | `depth: 0`                               |

Each library error has a `key` property. It's the path up to the path part that
caused the error. For example, `a.b` = `y` and then `a.b[0]` = `x` throw
`DuplicateKeyError('a.b')`. In `ForbiddenKeyError`, `DepthLimitError` and
`InvalidPathError`, a `key` longer than 100 characters is cut to 100 characters
plus `...`.

`key` is the path after `transformEntry`, not the field name. So it doesn't have
the `+`, `&` or `-`: `+a.b.c` with `depth: 2` throws `DepthLimitError('a.b.c')`.
A custom `transformEntry` can change the path completely. If you use `key` to
find the form field, undo your own transform first.

The entries are parsed in order, so the error of an earlier entry comes first.
In one entry, the depth is checked first: a path that's too deep throws
`DepthLimitError`, even if it has `__proto__` in it.

```ts
try {
  parseFormData(formData)
} catch (error) {
  if (error instanceof DuplicateKeyError) {
    return badRequest(`The field ${error.key} is used more than once`)
  }
  throw error
}
```

## Security

`__proto__`, `constructor` and `prototype` could change `Object.prototype`. So a
path part with one of these names throws a `ForbiddenKeyError`, in every
position, with or without brackets:

```ts
const formData = new FormData()
formData.append('user.__proto__.isAdmin', 'true')
parseFormData(formData)
// throws ForbiddenKeyError('user.__proto__')
```

Other names that exist on `Object.prototype` at parse time (`toString`,
`hasOwnProperty`, …, and names that a newer runtime or other code adds) would
hide a built-in method of the result. So the parser removes every entry with
such a name in its path. It parses the entry like any other entry first, so the
entry causes the same errors as any other name. Because of this, an error
doesn't tell the client which properties exist on the server's
`Object.prototype`.

```ts
const formData = new FormData()
formData.append('user.name', 'Ada')
formData.append('user.toString', 'x')
formData.append('settings.valueOf', 'x')
parseFormData(formData)
// {user: {name: 'Ada'}}
```

For input from untrusted clients, also set the [`depth`](#depth) option.

## Supported runtimes

The library uses only ES2020 and no runtime APIs. It works in:

- browsers
- Node.js (CI tests versions 22, 24 and 26)
- Deno
- Bun
- Cloudflare Workers
- Vercel (Edge and Node.js runtimes)

The package has ESM, CommonJS and UMD builds. In a `<script>` tag, the UMD build
sets the global `parseNestedFormData`.

## Issues

_Looking to contribute? Look for the [Good First Issue][good-first-issue] label,
and see [CONTRIBUTING.md](CONTRIBUTING.md) for how to set up the project._

### 🐛 Bugs

Please open an issue for bugs, missing documentation or unexpected behavior.

[**See Bugs**][bugs]

### 💡 Feature Requests

Please open an issue to suggest new features. Vote on feature requests with a
👍. This helps maintainers decide what to work on.

[**See Feature Requests**][requests]

## Contributors ✨

Thanks goes to these people ([emoji key][emojis]):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors][all-contributors] specification.
Contributions of any kind welcome!

## LICENSE

MIT

## Special Thanks

Special thanks to Kent C. Dodds and his [match-sorter][match-sorter] package
where most of the setup is from.

<!-- prettier-ignore-start -->
[build-badge]: https://img.shields.io/github/actions/workflow/status/milamer/parse-nested-form-data/validate.yml?branch=main&logo=github&style=flat-square
[build]: https://github.com/milamer/parse-nested-form-data/actions?query=workflow%3Avalidate
[coverage-badge]: https://img.shields.io/codecov/c/github/milamer/parse-nested-form-data.svg?style=flat-square
[coverage]: https://codecov.io/github/milamer/parse-nested-form-data
[version-badge]: https://img.shields.io/npm/v/parse-nested-form-data.svg?style=flat-square
[package]: https://www.npmjs.com/package/parse-nested-form-data
[size-badge]: https://img.shields.io/badge/min%2Bbrotli-%3C%202%20kB-brightgreen?style=flat-square
[size]: https://github.com/milamer/parse-nested-form-data/blob/main/.size-limit.json
[downloads-badge]: https://img.shields.io/npm/dm/parse-nested-form-data.svg?style=flat-square
[npmtrends]: https://www.npmtrends.com/parse-nested-form-data
[license-badge]: https://img.shields.io/npm/l/parse-nested-form-data.svg?style=flat-square
[license]: https://github.com/milamer/parse-nested-form-data/blob/main/LICENSE
[prs-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square
[prs]: http://makeapullrequest.com
[coc-badge]: https://img.shields.io/badge/code%20of-conduct-ff69b4.svg?style=flat-square
[coc]: https://github.com/milamer/parse-nested-form-data/blob/main/CODE_OF_CONDUCT.md
[emojis]: https://github.com/all-contributors/all-contributors#emoji-key
[all-contributors]: https://github.com/all-contributors/all-contributors
[all-contributors-badge]: https://img.shields.io/github/all-contributors/milamer/parse-nested-form-data?color=orange&style=flat-square
[bugs]: https://github.com/milamer/parse-nested-form-data/issues?utf8=%E2%9C%93&q=is%3Aissue+is%3Aopen+sort%3Acreated-desc+label%3Abug
[requests]: https://github.com/milamer/parse-nested-form-data/issues?utf8=%E2%9C%93&q=is%3Aissue+is%3Aopen+sort%3Areactions-%2B1-desc+label%3Aenhancement
[good-first-issue]: https://github.com/milamer/parse-nested-form-data/issues?utf8=%E2%9C%93&q=is%3Aissue+is%3Aopen+sort%3Areactions-%2B1-desc+label%3Aenhancement+label%3A%22good+first+issue%22
[match-sorter]: https://github.com/kentcdodds/match-sorter/blob/main/README.md
<!-- prettier-ignore-end -->
