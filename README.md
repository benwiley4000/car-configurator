# car-configurator
A sample app built using the 3dverse Livelink SDK to manipulate a scene in 3dverse.

This app is written with plain HTML, CSS and JavaScript, plus a few Handlebars templates for data-driven HTML elements. The only external libraries it uses are Handlebars and the 3dverse Livelink SDK. But of course you can use whatever UI framework you prefer (React, Vue, Svelte, Angular, etc), to build your own 3dverse application.

IMMEDIATE TODO
4. implement sync for rotation and cubemap somehow
4.5. implement sync for luminosity just at beginning
5. implement user avatars
6. Get rid of remaining tailwind classes
7. Put in the button baptiste wanted

## Code style stuff
10. heavy use of jsdoc typescript so autocomplete works well (remove object type as well)
11. Remove useless html after cleaning up css/tailwind usage
13. really enforce 80char col

## We need the general update flow for every action to go:
4. We need to init state from 3dverse and then subscribe to 3dverse changes as well.
5. Then enable createOrJoinSession and test.

## Bugs
3. audit rendering perf
4. The arrows switching between cars seem sometimes non-responsive (try doing it a bunch)
7. there's a bug with switching cars.. eventually you cannot do it anymore.
8. Why did we stop waiting for connectionInfo.sessionCreated?
10. Replace tailwind (after making a bunch of templates)
11. Fix app in Safari and maybe firefox
12. no client avatars?

## app changes
- Add tooltips to UI (in form of title="")
- Implement session timeout warning, and add UI for reconnecting after session is closed.
- Randomize initial viewing angle to increase the chance that you can see others in the scene.
- Add some UI to show others in the scene. Maybe we can publish the client list as an embeddable react component.
- Find less shitty-looking skyboxes?
- More obvious tab layout/hierarchy for toolbox part selection
- and dont hide part selection on mobile
- note in ui that luminosity is only for user

## 3dverse stuff
1. In general I should do an audit to make sure all the used apis are public (e.g. FTL)
2. I need to go and make sure we're taking advantage of best camera settings
3. Try to see what I can do to minimize number of calls to SDK (maybe reparent everything under main container and use .isVisible?). Also talk to Alex to figure out why I always get problems when I switch cars. See if there's any other UI actions that also can cause this.

## SDK TODO
- Make it so we don't throw an error whenever the session is closed (but preserve behavior that relies on this in collaborate.. figure out how to handle this differently).
- Replace undocumented ftl API usage with something else
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
