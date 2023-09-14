# car-configurator
A sample car configurator using 3dverse labs microverse

1. There's some thrashing back and forth with the presence of the spoiler, bumpers
2. Colors are changed but not persisted (and other stuff I guess)
3. audit rendering perf
4. The arrows switching between cars seem sometimes non-responsive.
5. We are doing a bunch of getassetdescriptions that can be slow and can block changes to FTL
6. There might be a bug with color selection state
7. there's a bug with switching cars.. eventually you cannot do it anymore.


3dverse stuff
1. In general I should do an audit to make sure all the used apis are public (e.g. FTL)

Style stuff
1. Global variables need to be more explicitly/clearly declared and accessed. Maybe all on a class.
2. Maybe don't use React?
3. camelCase instead of pascal
4. Maybe divide javascript into model/viewmodel type of stuff
5. maybe use handlebars or something for template?
6. We are duplicating HTML content between the AppConfig descriptions and the HTML content itself. We should probably remove it from the HTML.
7. We might be able to make the loading time feel faster by either giving more information, or trying to find some optimizations, or both.
8. remove g_SelectedCar (replace by index)
9. Add tooltips to UI (in form of title="")

We need the general update flow for every action to go:
1. Update state variables (this all has to happen first)
2. Call 3dverse to do something if needed
3. Trigger a render function that renders as a function of the state variables - no classList.toggle().



MAYBE use web components?

Code also needs to be refactored so that any changes to app state on one client are reflected in the next client. In order to test this we need to use createOrJoinSession.



replace let by const when possible.


Randomize initial viewing angle to increase the chance that you can see others in the scene.

Add some UI to show others in the scene. Maybe we can publish the client list as an embeddable react component.
