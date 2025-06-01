declare module 'passport-gitlab2' {
  import { Strategy as PassportStrategy } from 'passport';
  
  export interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string[];
  }

  export interface Profile {
    id: string;
    username: string;
    displayName: string;
    emails?: Array<{ value: string }>;
    photos?: Array<{ value: string }>;
    provider: string;
    _json: any;
  }

  export class Strategy extends PassportStrategy {
    constructor(options: StrategyOptions, verify: (
      accessToken: string,
      refreshToken: string,
      profile: Profile,
      done: (error: any, user?: any) => void
    ) => void);
  }
} 