import { all } from 'redux-saga/effects';
import Auth from './Auth';
import Student from './Student';
import Class from './Class';

export default function* rootSaga(getState) {
  yield all([
    Auth(),
    Student(),
    Class(),
  ]);
}
