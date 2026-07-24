import React from 'react'
import { Route, Switch, Redirect } from 'react-router-dom';
import StudentList from './student-list/StudentList';

const Student = ({ match }) => {
	return (
		<Switch>
			<Redirect exact from={`${match.url}`} to={`${match.url}/list`} />
			<Route path={`${match.url}/list`} component={StudentList} />
		</Switch>
	)
}

export default Student
