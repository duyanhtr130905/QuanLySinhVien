export interface StudentPageQuery {
  page: number;
  size: number;
  order?: string;
  search?: string;
  columnlist?: string;
  toplist: number[];
  excludeIds: number[];
}

export interface StudentWriteInput {
  code?: string;
  fullname?: string;
  dob?: string | null;
  sex?: boolean | null;
  homecity?: string;
  address?: string;
  hair_color?: string;
  email?: string;
  facebook?: string | null;
  class_id?: number | null;
  username?: string;
  password?: string;
  description?: string;
  hobbies?: number;
  attachment?: string | null;
}
