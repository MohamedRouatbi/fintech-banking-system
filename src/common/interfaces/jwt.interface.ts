export interface JwtPayload {
  sub: number;
  email: string;
  roles: string[];
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}
