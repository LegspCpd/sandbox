import { User } from "@clerk/backend"

export interface AppBindings {
  Variables: {
    user: User
  }
}
