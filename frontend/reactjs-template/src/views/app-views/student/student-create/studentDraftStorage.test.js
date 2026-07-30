import {
  clearStudentCreateDraft, deserializeStudentDraft, loadStudentCreateDraft,
  saveStudentCreateDraft, serializeStudentDraft, STUDENT_CREATE_DRAFT_KEY,
  STUDENT_CREATE_DRAFT_VERSION,
} from './studentDraftStorage'

const draftValues = {
  code: 'SV01',
  fullname: 'Nguyen Van A',
  dob: { format: () => '2004-01-15' },
  sex: false,
  class_id: '12',
  homecity: 'Ha Noi',
  address: '1 Pho Hue',
  hobbies: [1, 4],
  description: 'Dang nhap do',
  hair_color: '#112233',
  email: 'a@example.com',
  facebook: 'https://facebook.com/a',
  username: 'nguyenvana',
  password: 'Passw0rd!',
  attachment: new File(['image'], 'card.png', { type: 'image/png' }),
}

describe('student create draft storage', () => {
  beforeEach(() => window.localStorage.clear())

  test('serializes safe create values without a password, File, or object URL', () => {
    const draft = serializeStudentDraft(draftValues, { hasAttachment: true })
    expect(draft).toMatchObject({
      version: STUDENT_CREATE_DRAFT_VERSION,
      values: {
        code: 'SV01', dob: '2004-01-15', sex: false, class_id: 12, hobbies: [1, 4],
      },
      hadAttachment: true,
    })
    expect(JSON.stringify(draft)).not.toContain('Passw0rd!')
    expect(draft.values).not.toHaveProperty('password')
    expect(draft.values).not.toHaveProperty('attachment')
  })

  test('saves one current draft and restores its schema-safe values', () => {
    expect(saveStudentCreateDraft(draftValues, { hasAttachment: true })).toBe(true)
    const rawDraft = window.localStorage.getItem(STUDENT_CREATE_DRAFT_KEY)
    expect(rawDraft).not.toContain('Passw0rd!')
    expect(rawDraft).not.toContain('card.png')
    expect(loadStudentCreateDraft()).toMatchObject({
      version: STUDENT_CREATE_DRAFT_VERSION,
      values: { code: 'SV01', dob: '2004-01-15', class_id: 12, hobbies: [1, 4] },
      hadAttachment: true,
    })
  })

  test('clears a saved draft', () => {
    saveStudentCreateDraft(draftValues)
    clearStudentCreateDraft()
    expect(window.localStorage.getItem(STUDENT_CREATE_DRAFT_KEY)).toBeNull()
  })

  test('drops malformed JSON and incompatible draft versions without throwing', () => {
    window.localStorage.setItem(STUDENT_CREATE_DRAFT_KEY, '{not-json')
    expect(loadStudentCreateDraft()).toBeNull()
    expect(window.localStorage.getItem(STUDENT_CREATE_DRAFT_KEY)).toBeNull()

    window.localStorage.setItem(STUDENT_CREATE_DRAFT_KEY, JSON.stringify({
      version: 999,
      savedAt: new Date().toISOString(),
      values: { hobbies: [] },
    }))
    expect(loadStudentCreateDraft()).toBeNull()
    expect(window.localStorage.getItem(STUDENT_CREATE_DRAFT_KEY)).toBeNull()
    expect(deserializeStudentDraft('not-json')).toBeNull()
  })
})
