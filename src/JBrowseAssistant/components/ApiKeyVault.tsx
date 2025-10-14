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
import React, { useState } from 'react'
import { useForm } from 'react-hook-form'

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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { withExceptionCapturing } from '@/lib/utils'

import {
  ApiKeyVaultAuth,
  ApiKeyVaultAuthPromptSchema,
  IApiKeyVaultModel,
} from './model/ApiKeyVaultModel'
import { IChatWidgetModel } from './model/ChatbotWidgetModel'

export const ApiKeyVault = observer(function ({
  model,
}: {
  model: IChatWidgetModel
}) {
  const { apiKeyVault, settingsForm } = model
  const provider = settingsForm.settings.provider
  const [apiKey, setApiKey] = useState('')
  const [vaultStatus, setVaultStatus] = useState(apiKeyVault.status())
  const [isKeyAvailable, setIsKeyAvailable] = useState(
    apiKeyVault.exists(provider),
  )
  const saveKey = () => {
    apiKeyVault
      .set(provider, apiKey)
      .then(() => {
        setApiKey('')
        setVaultStatus(apiKeyVault.status())
        setIsKeyAvailable(apiKeyVault.exists(provider))
      })
      .catch(error => {
        if (error instanceof Error && error.message === 'cancelled') {
          setVaultStatus(apiKeyVault.status())
        } else {
          console.error(error)
        }
      })
  }
  return (
    <FormItem>
      <Label>API Key</Label>
      <InputGroup>
        <InputGroupInput
          type="password"
          aria-label="API key"
          value={apiKey}
          onChange={e => setApiKey(e.target.value)}
          placeholder={
            isKeyAvailable
              ? 'Modify saved key...'
              : vaultStatus === 'locked'
                ? 'Set API key... (vault is locked)'
                : 'Add API key...'
          }
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            aria-label="Save API key"
            title="Save API key"
            onClick={saveKey}
            type="button"
            variant="default"
          >
            Save
            {isKeyAvailable ? (
              <RotateCcwKeyIcon />
            ) : vaultStatus === 'locked' ? (
              <LockKeyholeIcon />
            ) : (
              <KeyIcon />
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </FormItem>
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
    form.reset()
  }
  const onOpenChange = (open: boolean) => {
    if (!open) model.closePasswordPrompt()
    setVaultStatus(model.status())
  }
  const onSubmit = withExceptionCapturing(
    form.handleSubmit(({ password }: ApiKeyVaultAuth) => {
      model.inputPassword(password)
      form.reset()
    }),
  )
  return (
    <Dialog open={model.isAuthenticating} onOpenChange={onOpenChange}>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>API Key Vault</DialogTitle>
              <DialogDescription>
                We encrypt API keys in your browser using a password you
                provide.
                <br />
                Your chosen password is never stored or transmitted.
                <br />
                API keys are only shared with their associated LLM provider.
                <br />
                Please ensure that you trust all loaded plugins and 3rd party
                scripts in this JBrowse session before proceeding.
              </DialogDescription>
            </DialogHeader>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="my-3">
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      {...field}
                      value={field.value || ''}
                      autoComplete={
                        vaultStatus === 'unset'
                          ? 'new-password'
                          : 'current-password'
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
        </Form>
      </DialogContent>
    </Dialog>
  )
})
