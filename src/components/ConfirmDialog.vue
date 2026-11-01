<script setup lang="ts">
import { ref, watch } from 'vue';
import { t } from '~/modules/i18n';

const props = defineProps<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();

const dialog = ref<HTMLDialogElement | null>(null);

watch(
  () => props.open,
  (v) => {
    if (v) dialog.value?.showModal();
    else dialog.value?.close();
  },
);

function onCancel() {
  emit('close');
}

function onConfirm() {
  emit('confirm');
}
</script>

<template>
  <dialog ref="dialog" class="bmm-dialog" @close="emit('close')">
    <div class="bmm-dialog-body">
      <h3>{{ title }}</h3>
      <p class="bmm-dialog-message">{{ message }}</p>
      <div class="bmm-dialog-actions">
        <button type="button" class="bmm-btn" @click="onCancel">
          {{ cancelLabel ?? t('confirm.cancel') }}
        </button>
        <button type="button" class="bmm-btn bmm-btn-danger" @click="onConfirm">
          {{ confirmLabel ?? t('confirm.delete') }}
        </button>
      </div>
    </div>
  </dialog>
</template>
