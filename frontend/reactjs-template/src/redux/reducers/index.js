import { combineReducers } from 'redux';
import Auth from './Auth';
import Theme from './Theme';
import Student from './Student';

const reducers = combineReducers({
    theme: Theme,
    auth: Auth,
    student: Student
});

export default reducers;