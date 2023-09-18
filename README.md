# car-configurator
A sample car configurator using 3dverse labs microverse

## Code style stuff
1. Global variables need to be more explicitly/clearly declared and accessed. Maybe all on a class.
2. Maybe don't use React?
3. camelCase instead of pascal
4. Maybe divide javascript into model/viewmodel type of stuff
5. maybe use handlebars or something for template?
6. We are duplicating HTML content between the AppConfig descriptions and the HTML content itself. We should probably remove it from the HTML.
7. remove g_SelectedCar (replace by index)
8. replace let by const when possible.
9. MAYBE use web components?
10. heavy use of jsdoc typescript so autocomplete works well

## We need the general update flow for every action to go:
1. Update state variables (this all has to happen first)
2. Call 3dverse to do something if needed
3. Trigger a render function that renders as a function of the state variables - no classList.toggle().
4. Code also needs to be refactored so that any changes to app state on one client are reflected in the next client. In order to test this we need to use createOrJoinSession.

## Bugs
1. There's some thrashing back and forth with the presence of the spoiler, bumpers
2. Colors are changed but not persisted (and other stuff I guess)
3. audit rendering perf
4. The arrows switching between cars seem sometimes non-responsive.
5. We are doing a bunch of getassetdescriptions that can be slow and can block changes to FTL
6. There might be a bug with color selection state
7. there's a bug with switching cars.. eventually you cannot do it anymore.
8. Why did we stop waiting for connectionInfo.sessionCreated?
9. Try to reduce time of no car when switching cars

## app changes
- Add tooltips to UI (in form of title="")
- We might be able to make the loading time feel faster by either giving more information, or trying to find some optimizations, or both.
- Implement session auto-refresh (if necessary, use console logs in SDK to check), and add UI for reconnecting after session is closed.
- Randomize initial viewing angle to increase the chance that you can see others in the scene.
- Edit UI for nav arrows 
- Add some UI to show others in the scene. Maybe we can publish the client list as an embeddable react component.

## 3dverse stuff
1. In general I should do an audit to make sure all the used apis are public (e.g. FTL)
2. I need to go and make sure we're taking advantage of best camera settings

## SDK TODO
- Make it so we don't throw an error whenever the session is closed (but preserve behavior that relies on this in collaborate.. figure out how to handle this differently).
- Replace undocumented ftl API usage with something else
- Maybe repetitive routines?
- Make sure clients show up with avatars and colors

## Other stuff
- Maybe make react component for client list and embed it?

