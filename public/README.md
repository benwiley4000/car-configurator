# car-configurator
A sample app built using the 3dverse Livelink SDK to manipulate a scene in 3dverse.

This app is written with plain HTML, CSS and JavaScript, plus a few Handlebars templates for data-driven HTML elements. The only external libraries it uses are Handlebars and the 3dverse Livelink SDK. But of course you can use whatever UI framework you prefer (React, Vue, Svelte, Angular, etc), to build your own 3dverse application.

Here is the basic flow of this app:

![Car Configurator Flowchart](./car-config-flowchart.png)

(This chart was created with [flowchart.fun](https://flowchart.fun/))

IMMEDIATE TODO
4.5. remaining code style refactors
5. fix bugs
6. implement features list
qr code
7. 3dverse sdk changes

## Code style stuff
11. Remove useless html after cleaning up css/tailwind usage

## Bugs
4. The arrows switching between cars seem sometimes non-responsive (try doing it a bunch). this could be maybe solved by using isVisible instead of reparenting. there is also a bug where sometimes the car switch just doesnt happen. i should document this change and share a repro before i switch to is visible. NOTE: don't try to fix this until after we are using the transient scene. This will maybe resolve issues.

## app changes
- Add tooltips to UI (in form of title="")
- implement user avatars
- More obvious tab layout/hierarchy for toolbox part selection
- better ui halo for colors
- Put in the button baptiste wanted
- Implement session timeout warning, and add UI for reconnecting after session is closed.
- Randomize initial viewing angle to increase the chance that you can see others in the scene.
- Add some UI to show others in the scene. Maybe we can publish the client list as an embeddable react component.
- Find less shitty-looking skyboxes?

## 3dverse stuff
1. In general I should do an audit to make sure all the used apis are public (e.g. FTL)
2. I need to go and make sure we're taking advantage of best camera settings (talk to Rados)

## SDK TODO
- Make it so we don't throw an error whenever the session is closed (but preserve behavior that relies on this in collaborate.. figure out how to handle this differently).
- Replace undocumented asset api usage with something else
- better api for starting a session
- this needs to include setting up client avatars
- Maybe repetitive routines?
- Make sure clients show up with avatars and colors
- Maybe make it possible to pass a set of scene changes along with createSession, or to precreate entities on the backend with preset entity visible states

## Other stuff
- Maybe make react component for client list and embed it?
- Make some JS tools for generating the entities from code?
- Document app design principles for 3dverse app
- Come up with short challenges we can give new users to modify the behavior of the app (ideally done in a way that users don't need to access the editor right away)
- check for TODO to resolve everything
- turn on strict types and update everything (and get rid of "object")
