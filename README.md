# KeysVST

A simple web-based, 7-octave, 88-key keyboard VST. This module is part of [Chakavang](https://github.com/chakavang) project.

[![Keys VST Preview](./docs/preview.png)](https://chakavang.github.io/KeysVST/examples/virtualpiano.html)

## How to Run

```
var vst = new KeysVST();
vst.run("./path/to/samples", function(view) {
    document.body.appendChild(view);
});
```

To display the VST in a web browser, please append the passed view object to the body element or any container element in a HTML document. The first parameter specifies the directory of the audio samples.

The source code of a working example is available in `examples/` directory. If you want to try examples on your own local machine, in the main directory of the project [run a http server](https://gist.github.com/willurd/5720255) on `8000` port and go to `127.0.0.1:8000/examples/` address in your web browser.

Try online examples:

- [Virtual Piano](https://chakavang.github.io/KeysVST/examples/virtualpiano.html)

## Keyboard Map

![Keys VST qwerty keyboard](./docs/qwerty_keyboard.png)

Hotkey | Description
------ | -----------
`ctrl` + `shift` + NUMBER (1-5) | Shift Octaves

## Browser Support

Browser | Version | Browser | Version
------- | ------- | ------- | -------
Chrome | 35 | Internet Explorer | NO
Edge | ALL | Opera | 22
Firefox | 25 | Safari | 6

## License

The KeysVST is open-source library licensed under the [MIT license](https://opensource.org/licenses/MIT). For the full copyright and license information, please view the LICENSE file that was distributed with this source code.