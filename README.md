<div align="center">
<h1>parse-form-data</h1>

<p>A tiny node module for parsing FormData by name into objects and arrays</p>
</div>

---

<!-- prettier-ignore-start -->
[![Build Status][build-badge]][build]
[![Code Coverage][coverage-badge]][coverage]
[![version][version-badge]][package]
[![downloads][downloads-badge]][npmtrends]
[![MIT License][license-badge]][license]
[![All Contributors][all-contributors-badge]](#contributors-)
[![PRs Welcome][prs-badge]][prs]
[![Code of Conduct][coc-badge]][coc]
<!-- prettier-ignore-end -->

## The problem

1.  You use Forms to upload data to your server (e.g. with remix-run)
2.  You want a way to upload objects and arrays with booleans and numbers
3.  You do not want to transfer the data per hand

## This solution

A parse functions that uses the name prop to tells the parser how to create an
object out of the values. You can tell the parser to do not parse empty values.

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Installation](#installation)
- [Name](#name)
  - [Boolean](#boolean)
  - [Number](#number)
  - [Null](#null)
  - [Array](#array)
  - [Object](#object)
- [Basic Usage](#basic-usage)
  - [Transform values](#transform-values)
- [Advanced usage](#advanced-usage)
  - [Options](#options)
  - [removeEmptyString: `[boolean]`](#removeemptystring-boolean)
  - [transformEntry: `(entry: [path: string, value: string | File], defaultTransform: DefaultTransform) => [string, string | JsonLeafValue]`](#transformentry-entry-path-string-value-string--file-defaulttransform-defaulttransform--string-string--jsonleafvalue)
- [Issues](#issues)
  - [🐛 Bugs](#-bugs)
  - [💡 Feature Requests](#-feature-requests)
- [Contributors ✨](#contributors-)
- [LICENSE](#license)
- [Special Thanks](#special-thanks)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Installation

This module is distributed via [npm][npm] which is bundled with [node][node] and
should be installed as one of your project's `dependencies`:

```sh
npm install parse-form-data
```

## Name

The name prop is used to tell the parser how to create an object out of the
values. The name prop is a string that can contain the following characters:

- `.`: to create a nested object
- `[]`: to create an array (pushes value)
- `[$order]`: to create an array (sets value at index and squashes array)
- `&`: to transform the value to a boolean
- `-`: to transform the value to null
- `+`: to transform the value to a number

### Boolean

If the name prop starts with a `&` the value will be transformed to a boolean.

True if the value has the following values:

- `true`
- `1`
- `on`

```ts
const formData = new FormData()
formData.append('&isTrue', 'true')
formData.append('&isFalse', 'false')
formData.append('&isTrue1', '1')
formData.append('&isFalse1', '0')
formData.append('&isTrue2', 'on')
formData.append('&isFalse2', 'off')
parseFormData(formData)
// {
//   isTrue: true,
//   isFalse: false,
//   isTrue1: true,
//   isFalse1: false,
//   isTrue2: true,
//   isFalse2: false,
// }
```

### Number

If the name prop starts with a `+` the value will be transformed to a number.

```ts
const formData = new FormData()
formData.append('+number', '1')
formData.append('+number2', '1.1')
formData.append('+number3', 'a')
parseFormData(formData)
// {
//   number: 1,
//   number2: 1.1,
//   number3: NaN,
// }
```

### Null

If the name prop starts with a `-` the value will be transformed to null.

```ts
const formData = new FormData()
formData.append('-null', 'null')
formData.append('-ignored', 'ignored')
parseFormData(formData)
// {
//   null: null,
//   ignored: null,
// }
```

### Array

If a path of the name prop ends with `[]` the value will be pushed to an array.
If the path of the name prop ends with `[$order]` the value will be set at the
index of the order. Cannot be mixed with `[]`.

```ts
const formData = new FormData()
formData.append('array[0]', '1')
formData.append('array[1]', '2')
formData.append('array[2]', '3')
formData.append('array[3]', '4')
parseFormData(formData)
// {
//   array: ['1', '2', '3', '4'],
// }
```

```ts
const formData = new FormData()
formData.append('array[]', '1')
formData.append('array[]', '2')
formData.append('array[]', '3')
parseFormData(formData)
// {
//   array: ['1', '2', '3'],
// }
```

Also works with nested objects:

```ts
const formData = new FormData()
formData.append('array[0].a', '1')
formData.append('array[1].a', '2')
formData.append('array[2].a', '3')
parseFormData(formData)
// {
//   array: [{a: '1'}, {a: '2'}, {a: '3'}],
// }
```

Also works with nested arrays:

```ts
const formData = new FormData()
formData.append('array[0][]', '1')
formData.append('array[0][]', '2')
formData.append('array[1][]', '3')
formData.append('array[1][]', '4')
parseFormData(formData)
// {
//   array: [['1', '2'], ['3', '4']],
// }
```

### Object

If the name prop contains a `.` the value will be nested in an object.

```ts
const formData = new FormData()
formData.append('object.a', '1')
formData.append('object.b', '2')
parseFormData(formData)
// {
//   object: {
//     a: '1',
//     b: '2',
//   },
// }
```

## Basic Usage

### Transform values

```ts
const formData = new FormData()
formData.append('+a', '1')
formData.append('&b', 'true')
formData.append('-c', 'null')
formData.append('d', 'foo')
parseFormData(formData, defaultTransform)
// => {a: 1, b: true, c: null, d: 'foo'}
```

## Advanced usage

Complex examples:

```ts
const formData = new FormData()
formData.append('a[].b.c', '1')
formData.append('a[].b.d', '2')
formData.append('a[]', '3')
formData.append('b[0]', '4')
formData.append('+b[100]', '5')
parseFormData(formData)
// {
//   a: [
//     {
//       b: {
//         c: '1',
//         d: '2',
//       },
//     },
//     '3',
//   ],
//   b: ['4', 5],
// }
```

### Options

The second argument is an option object with following properties:

### removeEmptyString: `[boolean]`

_Default: `false`_

If `true` empty strings will be removed from the result.

```ts
const formData = new FormData()
formData.append('foo[1].foo', '')
formData.append('foo[1].bar', 'test2')
formData.append('foo[0].foo', 'test3')
formData.append('foo[0].baz', '4')

parseFormData(formData, {removeEmptyString: true})
// {foo: [{foo: 'test3', baz: '4'}, {bar: 'test2'}]}
```

### transformEntry: `(entry: [path: string, value: string | File], defaultTransform: DefaultTransform) => [string, string | JsonLeafValue]`

```ts
const formData = new FormData()
formData.append('a', 'a')
formData.append('b', 'b')
parseFormData(formData, {
  transformEntry: ([path, value], defaultTransform) => {
    return {
      path,
      value:
        typeof value === 'string'
          ? value.toUpperCase()
          : defaultTransform(value),
    }
  },
})
// => {a: 'A', b: 'B'}
```

## Issues

_Looking to contribute? Look for the [Good First Issue][good-first-issue]
label._

### 🐛 Bugs

Please file an issue for bugs, missing documentation, or unexpected behavior.

[**See Bugs**][bugs]

### 💡 Feature Requests

Please file an issue to suggest new features. Vote on feature requests by adding
a 👍. This helps maintainers prioritize what to work on.

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
[npm]: https://www.npmjs.com
[node]: https://nodejs.org
[build-badge]: https://img.shields.io/github/workflow/status/milamer/parse-form-data/validate?logo=github&style=flat-square
[build]: https://github.com/milamer/parse-form-data/actions?query=workflow%3Avalidate
[coverage-badge]: https://img.shields.io/codecov/c/github/milamer/parse-form-data.svg?style=flat-square
[coverage]: https://codecov.io/github/milamer/parse-form-data
[version-badge]: https://img.shields.io/npm/v/parse-form-data.svg?style=flat-square
[package]: https://www.npmjs.com/package/parse-form-data
[downloads-badge]: https://img.shields.io/npm/dm/parse-form-data.svg?style=flat-square
[npmtrends]: https://www.npmtrends.com/parse-form-data
[license-badge]: https://img.shields.io/npm/l/parse-form-data.svg?style=flat-square
[license]: https://github.com/milamer/parse-form-data/blob/master/LICENSE
[prs-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square
[prs]: http://makeapullrequest.com
[coc-badge]: https://img.shields.io/badge/code%20of-conduct-ff69b4.svg?style=flat-square
[coc]: https://github.com/milamer/parse-form-data/blob/master/CODE_OF_CONDUCT.md
[emojis]: https://github.com/all-contributors/all-contributors#emoji-key
[all-contributors]: https://github.com/all-contributors/all-contributors
[all-contributors-badge]: https://img.shields.io/github/all-contributors/milamer/parse-form-data?color=orange&style=flat-square
[bugs]: https://github.com/milamer/parse-form-data/issues?utf8=%E2%9C%93&q=is%3Aissue+is%3Aopen+sort%3Acreated-desc+label%3Abug
[requests]: https://github.com/milamer/parse-form-data/issues?utf8=%E2%9C%93&q=is%3Aissue+is%3Aopen+sort%3Areactions-%2B1-desc+label%3Aenhancement
[good-first-issue]: https://github.com/milamer/parse-form-data/issues?utf8=%E2%9C%93&q=is%3Aissue+is%3Aopen+sort%3Areactions-%2B1-desc+label%3Aenhancement+label%3A%22good+first+issue%22
[match-sorter]: https://github.com/kentcdodds/match-sorter/blob/main/README.md
<!-- prettier-ignore-end -->
