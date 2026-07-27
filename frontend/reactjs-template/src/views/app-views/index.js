import React, { lazy, Suspense } from "react";
import { Switch, Route, Redirect } from "react-router-dom";
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import Loading from 'components/shared-components/Loading';
import { APP_PREFIX_PATH } from 'configs/AppConfig'

export const AppViews = () => {
  return (
    <DndProvider backend={HTML5Backend}>
      <Suspense fallback={<Loading cover="content"/>}>
        <Switch>
        <Route path={`${APP_PREFIX_PATH}/dashboards`} component={lazy(() => import(`./dashboards`))} />
        <Route path={`${APP_PREFIX_PATH}/apps`} component={lazy(() => import(`./apps`))} />
        <Route path={`${APP_PREFIX_PATH}/components`} component={lazy(() => import(`./components`))} />
        <Route path={`${APP_PREFIX_PATH}/pages`} component={lazy(() => import(`./pages`))} />
        <Route path={`${APP_PREFIX_PATH}/maps`} component={lazy(() => import(`./maps`))} />
        <Route path={`${APP_PREFIX_PATH}/charts`} component={lazy(() => import(`./charts`))} />
        <Route path={`${APP_PREFIX_PATH}/docs`} component={lazy(() => import(`./docs`))} />
        <Route path={`${APP_PREFIX_PATH}/student`} component={lazy(() => import(`./student`))} />
        <Route path={`${APP_PREFIX_PATH}/class`} component={lazy(() => import(`./class`))} />
        <Redirect from={`${APP_PREFIX_PATH}`} to={`${APP_PREFIX_PATH}/student/list`} />
        </Switch>
      </Suspense>
    </DndProvider>
  )
}

export default React.memo(AppViews);
