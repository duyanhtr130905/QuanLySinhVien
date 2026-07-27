import React from 'react'
import { Route, Switch, Redirect } from 'react-router-dom';
import StudentList from './student-list/StudentList';
import StudentCreate from './student-create/StudentCreate';
import StudentDetail from './student-detail';
import StudentEdit from './student-edit';
import StudentImport from './student-import';
import StudentExport from './student-export/StudentExport';
import StudentCopy from './student-copy/StudentCopy';
import StudentCopyResult from './student-copy/StudentCopyResult';

const Student = ({ match }) => {
	return (
		<Switch>
			<Redirect exact from={`${match.url}`} to={`${match.url}/list`} />
			<Route path={`${match.url}/create`} component={StudentCreate} />
			<Route path={`${match.url}/edit/:id`} component={StudentEdit} />
			<Route path={`${match.url}/import`} component={StudentImport} />
			<Route path={`${match.url}/export`} component={StudentExport} />
			<Route path={`${match.url}/copy-result`} component={StudentCopyResult} />
			<Route path={`${match.url}/copy/:id`} component={StudentCopy} />
			<Route path={`${match.url}/detail/:id`} component={StudentDetail} />
			<Route path={`${match.url}/list`} component={StudentList} />
			<Redirect to={`${match.url}/list`} />
		</Switch>
	)
}

export default Student
