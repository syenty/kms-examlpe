import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ValidationPipe,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserResponseDto } from "./dto/user-response.dto";

@ApiTags("users")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "사용자 생성",
    description: "PII 데이터를 KMS로 암호화하여 새 사용자를 생성합니다.",
  })
  @ApiResponse({
    status: 201,
    description: "사용자가 성공적으로 생성되었습니다.",
    type: UserResponseDto,
  })
  @ApiResponse({ status: 400, description: "잘못된 요청 데이터입니다." })
  async create(@Body(ValidationPipe) createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({
    summary: "모든 사용자 조회",
    description: "모든 사용자 목록을 조회합니다. PII 데이터는 복호화되어 반환됩니다.",
  })
  @ApiResponse({ status: 200, description: "사용자 목록", type: [UserResponseDto] })
  async findAll(): Promise<UserResponseDto[]> {
    return this.usersService.findAll();
  }

  @Get(":id")
  @ApiOperation({ summary: "사용자 조회", description: "ID로 특정 사용자를 조회합니다." })
  @ApiParam({
    name: "id",
    description: "사용자 UUID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @ApiResponse({ status: 200, description: "사용자 정보", type: UserResponseDto })
  @ApiResponse({ status: 404, description: "사용자를 찾을 수 없습니다." })
  async findOne(@Param("id") id: string): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "사용자 정보 수정",
    description: "사용자 정보를 수정합니다. PII 데이터 변경 시 재암호화됩니다.",
  })
  @ApiParam({
    name: "id",
    description: "사용자 UUID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @ApiResponse({ status: 200, description: "사용자 정보가 수정되었습니다.", type: UserResponseDto })
  @ApiResponse({ status: 404, description: "사용자를 찾을 수 없습니다." })
  @ApiResponse({ status: 400, description: "잘못된 요청 데이터입니다." })
  async update(
    @Param("id") id: string,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "사용자 삭제", description: "사용자를 삭제합니다." })
  @ApiParam({
    name: "id",
    description: "사용자 UUID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @ApiResponse({ status: 204, description: "사용자가 삭제되었습니다." })
  @ApiResponse({ status: 404, description: "사용자를 찾을 수 없습니다." })
  async remove(@Param("id") id: string): Promise<void> {
    return this.usersService.remove(id);
  }
}
