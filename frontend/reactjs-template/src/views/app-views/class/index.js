import React from 'react'
import { Redirect, Route, Switch } from 'react-router-dom'
import ClassList from './class-list/ClassList'
import ClassForm from './class-form/ClassForm'
import ClassCopyResult from './class-copy/ClassCopyResult'
import ClassDetail from './class-detail/ClassDetail'
import ClassImport from './class-import/ClassImport'
import ClassExport from './class-export/ClassExport'

const ClassManagement = ({ match }) => (
  <Switch>
    <Redirect exact from={match.url} to={`${match.url}/list`} />
    <Route path={`${match.url}/create`} render={() => <ClassForm mode="create" />} />
    <Route path={`${match.url}/edit/:id`} render={() => <ClassForm mode="edit" />} />
    <Route path={`${match.url}/detail/:id`} component={ClassDetail} />
    <Route path={`${match.url}/copy-result`} component={ClassCopyResult} />
    <Route path={`${match.url}/copy/:id`} render={() => <ClassForm mode="copy" />} />
    <Route path={`${match.url}/import`} component={ClassImport} />
    <Route path={`${match.url}/export`} component={ClassExport} />
    <Route path={`${match.url}/list`} component={ClassList} />
    <Redirect to={`${match.url}/list`} />
  </Switch>
)

export default ClassManagement
