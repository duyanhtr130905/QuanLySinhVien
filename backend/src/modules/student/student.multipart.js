/**
 * Normalize values emitted by multipart/form-data without mutating req.body.
 * JSON inputs that already have their target type are deliberately retained.
 */
const normalizeMultipartBody = (body) => {
  const parsed = { ...body };

  if (typeof parsed.sex === 'string') {
    if (parsed.sex === 'true') parsed.sex = true;
    else if (parsed.sex === 'false') parsed.sex = false;
    else parsed.sex = null;
  }

  if (typeof parsed.class_id === 'string') {
    const classId = parseInt(parsed.class_id, 10);
    parsed.class_id = (parsed.class_id === '' || parsed.class_id === '-1' || isNaN(classId)) ? null : classId;
  }

  if (typeof parsed.hobbies === 'string') {
    const hobbies = parseInt(parsed.hobbies, 10);
    parsed.hobbies = (parsed.hobbies === '' || isNaN(hobbies)) ? 0 : hobbies;
  }

  return parsed;
};

module.exports = { normalizeMultipartBody };
