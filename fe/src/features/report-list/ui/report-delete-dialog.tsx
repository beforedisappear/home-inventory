import { useMutation } from '@tanstack/react-query';

import { reportQueries } from '@/services/report';

import { AlertDialog, Button, toast } from '@/shared/ui';

interface Props {
  reportId: string | null;
  onClose: () => void;
}

export function ReportDeleteDialog(props: Props) {
  const { reportId, onClose } = props;

  const { mutateAsync: deleteReport, isPending: isDeleting } = useMutation(
    reportQueries.delete(),
  );

  const handleDelete = async () => {
    if (!reportId) return;

    try {
      await deleteReport(reportId);
      onClose();
    } catch {
      toast.danger('Не удалось удалить отчёт');
    }
  };

  return (
    <AlertDialog.Root
      isOpen={reportId !== null}
      onOpenChange={isOpen => {
        if (!isOpen) onClose();
      }}
    >
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <div className='flex items-center gap-3'>
              <AlertDialog.Icon />
              <AlertDialog.Header className='mb-0'>
                <AlertDialog.Heading>Удалить отчёт?</AlertDialog.Heading>
              </AlertDialog.Header>
            </div>
            <AlertDialog.Body className='mt-2'>
              Это действие нельзя отменить.
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button type='button' variant='ghost' onPress={onClose}>
                Отмена
              </Button>
              <Button
                type='button'
                variant='danger'
                isDisabled={isDeleting}
                onPress={handleDelete}
              >
                Удалить
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog.Root>
  );
}
