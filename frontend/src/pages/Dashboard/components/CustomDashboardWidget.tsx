import { useRef, useState, type ChangeEvent } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  TextField,
  Typography,
} from '@mui/material'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { DashboardCustomWidget } from '@/contexts/DashboardLayoutContext'
import { useDashboardLayout } from '@/contexts/DashboardLayoutContext'

interface CustomDashboardWidgetProps {
  widget: DashboardCustomWidget
}

interface WidgetEditorDialogProps {
  widget: DashboardCustomWidget
  onClose: () => void
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <Typography component="h1" variant="h6" fontWeight={700} sx={{ mt: 0, mb: 0.8, lineHeight: 1.25 }}>
      {children}
    </Typography>
  ),
  h2: ({ children }) => (
    <Typography component="h2" variant="subtitle1" fontWeight={700} sx={{ mt: 1.1, mb: 0.7, lineHeight: 1.28 }}>
      {children}
    </Typography>
  ),
  h3: ({ children }) => (
    <Typography component="h3" variant="subtitle2" fontWeight={700} sx={{ mt: 1, mb: 0.6, lineHeight: 1.3 }}>
      {children}
    </Typography>
  ),
  h4: ({ children }) => (
    <Typography component="h4" variant="body2" fontWeight={700} sx={{ mt: 0.9, mb: 0.55, lineHeight: 1.35 }}>
      {children}
    </Typography>
  ),
  h5: ({ children }) => (
    <Typography component="h5" variant="body2" fontWeight={700} sx={{ mt: 0.8, mb: 0.5, lineHeight: 1.35 }}>
      {children}
    </Typography>
  ),
  h6: ({ children }) => (
    <Typography component="h6" variant="caption" fontWeight={700} sx={{ display: 'block', mt: 0.7, mb: 0.45, lineHeight: 1.35 }}>
      {children}
    </Typography>
  ),
  p: ({ children }) => (
    <Typography component="p" variant="body2" sx={{ m: 0, mb: 0.75, lineHeight: 1.55, overflowWrap: 'anywhere' }}>
      {children}
    </Typography>
  ),
  a: ({ href, title, children }) => (
    <Link href={href} title={title} target="_blank" rel="noopener noreferrer" underline="hover">
      {children}
    </Link>
  ),
  ul: ({ children }) => (
    <Box component="ul" sx={{ mt: 0, mb: 0.75, pl: 2.6, '& ul, & ol': { mt: 0.35, mb: 0.35 } }}>
      {children}
    </Box>
  ),
  ol: ({ children }) => (
    <Box component="ol" sx={{ mt: 0, mb: 0.75, pl: 2.6, '& ul, & ol': { mt: 0.35, mb: 0.35 } }}>
      {children}
    </Box>
  ),
  li: ({ children }) => (
    <Typography
      component="li"
      variant="body2"
      sx={{
        mb: 0.3,
        lineHeight: 1.5,
        pl: 0.2,
        overflowWrap: 'anywhere',
        '& > p': {
          display: 'inline',
          m: 0,
        },
      }}
    >
      {children}
    </Typography>
  ),
  blockquote: ({ children }) => (
    <Box
      component="blockquote"
      sx={{
        m: 0,
        mb: 0.85,
        pl: 1.2,
        borderLeft: 3,
        borderColor: 'divider',
        color: 'text.secondary',
        '& > :last-child': { mb: 0 },
      }}
    >
      {children}
    </Box>
  ),
  code: ({ className, children }) => (
    <Box
      component="code"
      className={className}
      sx={{
        px: 0.45,
        py: 0.12,
        borderRadius: 0.5,
        bgcolor: 'action.hover',
        fontFamily: 'ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace',
        fontSize: '0.9em',
      }}
    >
      {children}
    </Box>
  ),
  pre: ({ children }) => (
    <Box
      component="pre"
      sx={{
        m: 0,
        mb: 0.9,
        p: 1,
        borderRadius: 1,
        bgcolor: 'action.hover',
        overflow: 'auto',
        fontSize: '0.82rem',
        lineHeight: 1.45,
        '& code': {
          p: 0,
          bgcolor: 'transparent',
          borderRadius: 0,
          fontSize: 'inherit',
        },
      }}
    >
      {children}
    </Box>
  ),
  table: ({ children }) => (
    <Box sx={{ width: '100%', overflowX: 'auto', mb: 0.9 }}>
      <Box
        component="table"
        sx={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '0.78rem',
          lineHeight: 1.45,
        }}
      >
        {children}
      </Box>
    </Box>
  ),
  th: ({ children }) => (
    <Box
      component="th"
      sx={{
        px: 0.75,
        py: 0.55,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'action.hover',
        textAlign: 'left',
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Box>
  ),
  td: ({ children }) => (
    <Box
      component="td"
      sx={{
        px: 0.75,
        py: 0.5,
        border: 1,
        borderColor: 'divider',
        verticalAlign: 'top',
        overflowWrap: 'anywhere',
      }}
    >
      {children}
    </Box>
  ),
  hr: () => <Box component="hr" sx={{ my: 1, border: 0, borderTop: 1, borderColor: 'divider' }} />,
  img: ({ src, alt, title }) => (
    <Box
      component="img"
      src={src}
      alt={alt}
      title={title}
      sx={{
        display: 'block',
        maxWidth: '100%',
        maxHeight: 240,
        width: 'auto',
        height: 'auto',
        my: 0.8,
        borderRadius: 1,
        objectFit: 'contain',
      }}
    />
  ),
  input: ({ type, checked, disabled }) => (
    <Box
      component="input"
      type={type}
      checked={checked}
      disabled={disabled}
      readOnly
      sx={{
        mr: 0.65,
        transform: 'translateY(1px)',
      }}
    />
  ),
}

function MarkdownView({ value }: { value: string }) {
  return (
    <Box
      sx={{
        fontSize: '0.875rem',
        '& > :first-of-type': { mt: 0 },
        '& > :last-child': { mb: 0 },
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents} skipHtml>
        {value}
      </ReactMarkdown>
    </Box>
  )
}

function WidgetEditorDialog({ widget, onClose }: WidgetEditorDialogProps) {
  const { updateCustomWidget } = useDashboardLayout()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [title, setTitle] = useState(widget.title)
  const [content, setContent] = useState(widget.content)

  const handleSave = () => {
    updateCustomWidget(widget.id, { title, content })
    onClose()
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setContent(reader.result)
      }
    }
    reader.readAsDataURL(file)
    event.target.value = ''
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{widget.type === 'image' ? '图片框' : '文字框'}</DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <TextField
          label="标题"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          fullWidth
          margin="dense"
        />
        {widget.type === 'image' ? (
          <>
            <TextField
              label="图片地址"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              fullWidth
              margin="dense"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleFileChange}
            />
            <Button sx={{ mt: 1 }} onClick={() => fileInputRef.current?.click()}>
              选择图片
            </Button>
          </>
        ) : (
          <TextField
            label="Markdown"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            fullWidth
            multiline
            minRows={10}
            margin="dense"
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>取消</Button>
        <Button onClick={handleSave} variant="contained">保存</Button>
      </DialogActions>
    </Dialog>
  )
}

export function CustomDashboardWidget({ widget }: CustomDashboardWidgetProps) {
  const { editingWidgetId, setEditingWidgetId } = useDashboardLayout()
  const open = editingWidgetId === widget.id
  const handleClose = () => setEditingWidgetId(null)

  return (
    <>
      <Card sx={{ height: '100%' }}>
        <CardContent
          sx={{
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            p: widget.type === 'image' ? 1.25 : 2,
            '&:last-child': { pb: widget.type === 'image' ? 1.25 : 2 },
          }}
        >
          {widget.title && (
            <Typography
              variant="subtitle2"
              color="text.secondary"
              sx={{ mb: widget.type === 'image' ? 1 : 1.2, flex: '0 0 auto' }}
            >
              {widget.title}
            </Typography>
          )}

          {widget.type === 'image' ? (
            <Box
              sx={{
                flex: 1,
                minWidth: 0,
                minHeight: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                borderRadius: 1,
                bgcolor: 'action.hover',
              }}
            >
              {widget.content && (
                <Box
                  component="img"
                  src={widget.content}
                  alt={widget.title}
                  sx={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    minWidth: 0,
                    minHeight: 0,
                    objectFit: 'contain',
                    objectPosition: 'center center',
                  }}
                />
              )}
            </Box>
          ) : (
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <MarkdownView value={widget.content} />
            </Box>
          )}
        </CardContent>
      </Card>

      {open && <WidgetEditorDialog widget={widget} onClose={handleClose} />}
    </>
  )
}
