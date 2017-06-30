Inpladitor
==========

An in place editor for meteor

Installing using atmosphere
----------------------------

```
meteor add mahmost:inpladitor
```

Installing using npm
---------------------

```
meteor npm install inpladitor --save
```


Basic usage
------------

#### Required npm setup

If installed using npm :

- You need to put this in server side code

```
import Inpladitor from "inpladitor";
```

- And put this in client side code (in template files where you the editor event is found)

```
window.Inpladitor = require("inpladitor/handler");
import "inpladitor/css/style.css";
```

#### Editor Event

A basic event to make all text node in a template editable is :

```
Template.someName.event({
  'click *' : function (e, t) {
    Inpladitor.handler(e, t);
  }
});
```

License
--------
MIT
