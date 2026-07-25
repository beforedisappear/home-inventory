import { ContainerQrResponseDto } from '../dto/container-qr-response.dto';
import { ContainerResponseDto } from '../dto/container-response.dto';
import { ContainerDocument } from '../schemas/container.schema';

export class ContainerMapper {
  static toResponseDto(с: ContainerDocument): ContainerResponseDto {
    return {
      id: с._id.toString(),
      name: с.name,
      kind: с.kind,
      parentId: с.parentId?.toString() ?? null,
      rootId: с.rootId?.toString() ?? null,
      ruleId: с.ruleId?.toString() ?? null,
      createdAt: с.createdAt,
      updatedAt: с.updatedAt,
    };
  }

  static toQrResponseDto(
    doc: ContainerDocument,
    buildUrl: (key: string) => string,
  ): ContainerQrResponseDto {
    return {
      status: doc.qrStatus,
      url: doc.qrKey ? buildUrl(doc.qrKey) : null,
    };
  }
}
