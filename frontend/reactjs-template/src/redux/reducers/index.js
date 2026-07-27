import { combineReducers } from 'redux';
import Auth from './Auth';
import Theme from './Theme';
import Student from './Student';
import Class from './Class';

const reducers = combineReducers({
    theme: Theme,
    auth: Auth,
    student: Student,
    classroom: Class
});

export default reducers;
