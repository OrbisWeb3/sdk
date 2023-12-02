# Orbis TS SDK

> [!WARNING]  
> This SDK is still a work-in-progress. This is the only source of documentation as we finalize the SDK and accompanying resources.
>
> To understand the code better, look through the repository and provided types.

## Installation

This SDK is available on NPM, you can install it using your preferred package manager.

    npm install @orbisclub/sdk

## Description

Orbis TS SDK is a complete rewrite of our original JS SDK.\
As Orbis and its usage scaled, so did the demand for a better DX at scale. This SDK is made to support development at scale by providing types and a more abstract view of Orbis internals.

## Migration from JS SDK

> [!IMPORTANT]
> A complete migration guide will be provided together with other resources once this SDK reaches beta.

We recognize the annoyance of breaking backward compatibility, however, in order to make the future of Orbis development simpler and leaner we had to do it.

The majority of functions are named the same, however, their signatures have changed.

> [!IMPORTANT]
> Orbis TS SDK no longer provides errors as a response.
> You need to catch it using try{}catch{} or with a provided `catchError` utility method.

## Sample usage

Once the SDK is deemed finalized we will provide a complete documentation rewrite.

### Initialize the SDK

```typescript
import { Orbis } from "@orbisclub/sdk";

// Use Orbis defaults
const orbis = new Orbis({});

// Disable encryption, do not connect to Encryption nodes
const orbis = new Orbis({ encryption: false });

// Choose your own Ceramic Storage gateway
const orbis = new Orbis({
  storage: {
    gateway: "...",
  },
});
```

### Catching errors

When using the new SDK you have 2 main options to catch errors.

The third option is to not catch errors at all.

#### try / catch

Standard try/catch practices apply.

```typescript
let post
try{
    post = await orbis.createPost(...)
}catch(error){
    console.log("Error", error)
}

console.log("Result", post)
```

#### catchError

This is a utility method provided by Orbis, originally implemented in [Radash](https://github.com/rayepps/radash/blob/03dd3152f560414e933cedcd3bda3c6db3e8306b/src/async.ts#L265).\
We've modified the call signature to make it more convenient for our use case.

```typescript
import { catchError } from "@orbisclub/sdk"

const [post, error] = await catchError(
    () => orbis.createPost(...)
)

if(error){
    console.warn("Error", error)
}

console.log("Result", post)
```

### Connection

Our SDK now exports multiple Authentication providers. These replace the old `{ chain, provider }` methodology.

#### Scopes

Orbis TS SDK allows you to define the SDK to authenticate the user with, options are `storage` and `encryption`.

```typescript
import { OrbisResources } from "@orbisclub/sdk";

// OrbisResources.encryption
// OrbisResources.storage
```

#### EVM

```typescript
import { Orbis, OrbisResources } from "@orbisclub/sdk"
import { OrbisEVMAuth } from "@orbisclub/sdk/auth"

// Browser provider
const provider = window.ethereum

// Ethers provider
const provider = new Wallet(...)

// Orbis Authenticator
const auth = new OrbisEVMAuth(provider)
const authResult = await orbis.connectUser({ auth })

// Wait for the user profile to be indexed
await authResult.waitIndexing()

console.log({ authResult })

// By default all available scopes will be authenticated
// In case a scope is already authenticated it will *not* be removed
// Authenticate storage only
const authResult = await orbis.connectUser({ auth, scopes: [ OrbisResources.storage ]})
```

#### Check if a user is connected

This method always returns true/false.

```typescript
// Check if any user is connected
const connected = await orbis.isUserConnected()

// Check if a user with the specified wallet address is connected
const connected = await orbis.isUserConnected("0x00...")
```

#### Get the currently connected user

This method either returns the currently connected user (`OrbisConnectResult`) or `false`.

```typescript
// Get the currently connected user
const currentUser = await orbis.getConnectedUser()
if(!currentUser){
  // Notify the user or reconnect
  throw "There is no active user session."
}

console.log({ currentUser })
```

### Indexing

All methods that create or modify content, expose a `waitIndexing` method in their result. This allows you to guarantee Orbis' indexing nodes indexed and store the new content.

This has been done to allow quicker UI updates in case you don't care about the status of indexing or are handling multiple actions at once.

```typescript
import { MethodStatuses } from "@orbisclub/sdk"

// Create a stream
const post = await orbis.createPost({ ... })

// Wait for the stream to get indexed
const postIndexingResult = await post.waitIndexing()
// Alternatively you can check for the error field, as such: if ("error" in postIndexingResult)
if(postIndexingResult.status !== MethodStatuses.ok){
  throw `There was an error indexing post (${post.id}). Error: ${postIndexingResult.error}`
}

console.log(`Post (${post.id}) successfully indexed`, postIndexingResult.result)

// Fetch the post from Orbis nodes
const newPost = await orbis.getPost(post.id)
```

### Primitives (schemas)

All Orbis Ceramic schemas are auto-generated as types. They are used when creating or updating content such as `posts` or `contexts`.

Indexed content has different types due to additional metadata, formatting and social graph additions.

You can auto-generated schemas [here](/src/types/primitives/schemas.ts).\
The index of our schema streams is [here](/src/types/primitives/index.ts).\
Indexed content types are [here](/src/types/primitives/indexed.ts).

### Posts

#### Create a post

```typescript
const post = await orbis.createPost({
  body: "This is some content",
  context: "kjsd...ksx",
});

console.log("Created post:", post.id);

await post.waitIndexing();

console.log("Indexed post:", post.id);
```

#### Create an encrypted post

```typescript
import type { DIDPkh } from "@orbisclub/sdk";

// Create an encrypted post that only the current user can read
// User *must* be authenticated with encryption scopes
const encryptedPost = await orbis.createPost({
  body: "This is content which will be encrypted",
  encryptionRules: [
    {
      type: "dids",
      dids: [orbis.user.did as DIDPkh],
    },
  ],
});

console.log("Created an encrypted post:", encryptedPost.id);

await encryptedPost.waitIndexing();

console.log("Indexed an encrypted post", encryptedPost.id);
```

#### Get a post

```typescript
// By default, all posts will be decrypted silently (won't throw an error if unable to decrypt)
const post = await orbis.getPost("post_id");

// Disable post decryption
const post = await orbis.getPost("post_id", { decryptSilently: false });

console.log({ post });

// Either of these fields can be null depending on initial post's state
console.log({ decrypted: post.body.plain, encrypted: post.body.encrypted });
```
