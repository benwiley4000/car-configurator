# car-configurator
A sample app built using the 3dverse Livelink SDK to manipulate a scene in 3dverse.

This app is written with plain HTML, CSS and JavaScript, plus a few Handlebars templates for data-driven HTML elements. The only external libraries it uses are Handlebars and the 3dverse Livelink SDK. But of course you can use whatever UI framework you prefer (React, Vue, Svelte, Angular, etc), to build your own 3dverse application.

## app design principles

Here is the basic flow of this app:

![Car Configurator Flowchart](./car-config-flowchart.png)

(This chart was created with [flowchart.fun](https://flowchart.fun/))

Our Car Configurator allows many clients to join and manipulate the car details together, at once, in the same 3dverse Livelink session.

Because our app has no backend except for 3dverse itself, it has no choice but to rely on 3dverse as its source of truth.

So when we first load the app in a browser, and whenever another client makes a change to the scene, 3dverse lets us known, our application UI will update to correspond. These changes can include the selected car, the material properties, the car paint color (albedo), and a few others.

### another way of doing it

Note that if you made your own application for 3dverse that had its own application server, you could choose to have your application state defined by your database, or by the choices of a particular client peer, and manipulate the 3dverse scene as a function of this external state.

## api usage details

TBA: details on APIs used to accomplish different tasks
