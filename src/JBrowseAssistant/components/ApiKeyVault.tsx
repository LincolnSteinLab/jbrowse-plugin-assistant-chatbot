import { zodResolver } from '@hookform/resolvers/zod'
import {
  KeyIcon,
  LockKeyholeIcon,
  RotateCcwKeyIcon,
  ShredderIcon,
  UnlockKeyholeIcon,
  UserLockIcon,
} from 'lucide-react'
import { observer } from 'mobx-react'
import React, {
  Dispatch,
  KeyboardEventHandler,
  SetStateAction,
  useState,
} from 'react'
import { Controller, useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { withExceptionCapturing } from '@/lib/utils'

import { ChatModelProvider } from '../agent/ChatModel'

import {
  ApiKeyVaultAuth,
  ApiKeyVaultAuthPromptSchema,
  IApiKeyVaultModel,
} from './model/ApiKeyVaultModel'
import { IChatWidgetModel } from './model/ChatbotWidgetModel'

export const ApiKeyVault = observer(function ({
  model,
  provider,
  apiKeyExists,
  setApiKeyExists,
}: {
  model: IChatWidgetModel
  provider: ChatModelProvider
  apiKeyExists: boolean
  setApiKeyExists: Dispatch<SetStateAction<boolean>>
}) {
  console.log(provider)
  const { apiKeyVault } = model
  const [apiKey, setApiKey] = useState('')
  const [vaultStatus, setVaultStatus] = useState(apiKeyVault.status())
  const saveKey = () => {
    let vaultPromise: Promise<void>
    if (vaultStatus === 'locked') {
      vaultPromise = apiKeyVault.get(provider).then(() => {
        setVaultStatus(apiKeyVault.status())
        setApiKeyExists(apiKeyVault.exists(provider))
      })
    } else {
      vaultPromise = apiKeyVault.set(provider, apiKey).then(() => {
        setApiKey('')
        setVaultStatus(apiKeyVault.status())
        setApiKeyExists(apiKeyVault.exists(provider))
      })
    }
    vaultPromise.catch(error => {
      if (error instanceof Error && error.message === 'cancelled') {
        setVaultStatus(apiKeyVault.status())
      } else {
        console.error(error)
      }
    })
  }
  const apiKeyEnterKey: KeyboardEventHandler<HTMLInputElement> = e => {
    if (e.key === 'Enter') saveKey()
  }
  return (
    <Field>
      <Label htmlFor={`apiKey-${provider}`}>API Key</Label>
      <InputGroup>
        <InputGroupInput
          type="password"
          aria-label="API key"
          autoComplete="new-password"
          id={`apiKey-${provider}`}
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          onKeyDown={apiKeyEnterKey}
          placeholder={
            apiKeyExists
              ? 'Modify saved key...'
              : vaultStatus === 'locked'
                ? 'Set API key... (vault is locked)'
                : 'Add API key...'
          }
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label="Save/Unlock API key"
            title="Save/Unlock API key"
            onClick={saveKey}
            type="button"
            variant="default"
          >
            {apiKeyExists ? (
              <>
                Save
                <RotateCcwKeyIcon />
              </>
            ) : vaultStatus === 'locked' ? (
              <>
                Unlock
                <LockKeyholeIcon />
              </>
            ) : (
              <>
                Save
                <KeyIcon />
              </>
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  )
})

export const ApiKeyVaultAuthPrompt = observer(function ({
  model,
}: {
  model: IApiKeyVaultModel
}) {
  const [vaultStatus, setVaultStatus] = useState(model.status())
  const form = useForm<ApiKeyVaultAuth>({
    resolver: zodResolver(ApiKeyVaultAuthPromptSchema),
    defaultValues: { password: '' },
  })
  const clearVault = () => {
    model.clear()
    model.closePasswordPrompt()
    setVaultStatus(model.status())
    form.reset()
  }
  const onOpenChange = (open: boolean) => {
    setVaultStatus(model.status())
    if (!open) model.closePasswordPrompt()
  }
  const onSubmit = withExceptionCapturing(
    form.handleSubmit(({ password }: ApiKeyVaultAuth) => {
      model.inputPassword(password)
      form.reset()
    }),
  )
  const passwordEnterKey: KeyboardEventHandler<HTMLInputElement> = e => {
    if (e.key === 'Enter') onSubmit(e)
  }
  return (
    <Dialog open={model.isAuthenticating} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>API Key Vault</DialogTitle>
            <DialogDescription>
              We encrypt API keys in your browser using a password you provide.
              <br />
              Your chosen password is never stored or transmitted.
              <br />
              API keys are only shared with their associated LLM provider.
              <br />
              Please ensure that you trust all loaded plugins and 3rd party
              scripts in this JBrowse session before proceeding.
            </DialogDescription>
          </DialogHeader>
          <input
            id="username"
            name="username"
            autoComplete="username"
            type="text"
            defaultValue="JBrowse Assistant API Key Vault"
            className="hidden"
          />
          <FieldGroup className="my-3">
            <Controller
              name="password"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    autoComplete={
                      vaultStatus === 'unset'
                        ? 'new-password'
                        : 'current-password'
                    }
                    onKeyDown={passwordEnterKey}
                  />
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter>
            <Button variant="destructive" onClick={clearVault}>
              Destroy Vault
              <ShredderIcon />
            </Button>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">
              {vaultStatus === 'locked' ? (
                <>
                  Unlock
                  <UnlockKeyholeIcon />
                </>
              ) : vaultStatus === 'unset' ? (
                <>
                  Create
                  <UserLockIcon />
                </>
              ) : (
                <>
                  Authenticate
                  <LockKeyholeIcon />
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
})
